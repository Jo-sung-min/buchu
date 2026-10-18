package kr.co.buchu.ads;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:advertisement-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "buchu.catalog-resource=classpath:programs-test.json"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdvertisementApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test void applicationWaitsForApprovalAndPublicBoardHidesContactDetails() throws Exception {
        JsonNode created = apply(valid("부추툴즈"));
        assertThat(created.path("status").asText()).isEqualTo("PENDING");
        String id = created.path("id").asText();
        mvc.perform(get("/api/ads")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0))).andExpect(jsonPath("$.totalSlots").value(10)).andExpect(jsonPath("$.monthlyPriceKrw").value(300000));
        mvc.perform(post("/api/admin/ads/{id}/approve", id).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"months\":2,\"note\":\"입금 확인\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED")).andExpect(jsonPath("$.endsAt").exists());
        String board = mvc.perform(get("/api/ads")).andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].siteName").value("부추툴즈")).andReturn().getResponse().getContentAsString();
        assertThat(board).doesNotContain("contactEmail", "owner@example.com", "note");
    }

    @Test void rejectsInvalidInputAndRequiresCsrf() throws Exception {
        for (ObjectNode input : List.of(valid("x"), valid("부추툴즈").put("url", "javascript:alert(1)"), valid("부추툴즈").put("url", "ftp://example.com"),
                valid("부추툴즈").put("contactEmail", "not-an-email"), valid("부추툴즈").put("color", "red"), valid("부추툴즈").put("tagline", "가".repeat(61)),
                valid("부추툴즈").put("phone", "010-0000-0000"))) {
            send(input).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/ads/apply").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(valid("부추툴즈")))).andExpect(status().isForbidden());
    }

    @Test void onlyAdministratorsModerateAndStatesAreEnforced() throws Exception {
        String id = apply(valid("부추툴즈")).path("id").asText();
        mvc.perform(get("/api/admin/ads")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/ads/{id}/approve", id).with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/ads/{id}/approve", id).with(user("member").roles("USER")).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/ads/{id}/reject", id).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/ads/{id}/end", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/ads/{id}/reject", id).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"사이트 확인 불가\"}")).andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(post("/api/admin/ads/{id}/approve", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/ads").with(user("admin").roles("ADMIN")).param("status", "REJECTED"))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].contactEmail").value("owner@example.com"));
        mvc.perform(get("/api/admin/ads").with(user("admin").roles("ADMIN")).param("status", "WRONG")).andExpect(status().isBadRequest());
    }

    @Test void endingAnAdFreesItsSlotAndSlotsAreCapped() throws Exception {
        String first = apply(valid("첫 광고")).path("id").asText();
        approve(first);
        mvc.perform(get("/api/ads")).andExpect(jsonPath("$.items", hasSize(1)));
        mvc.perform(post("/api/admin/ads/{id}/end", first).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(jsonPath("$.status").value("ENDED"));
        mvc.perform(get("/api/ads")).andExpect(jsonPath("$.items", hasSize(0)));
        for (int index = 0; index < 10; index++) approve(apply(valid("광고 " + index)).path("id").asText());
        String overflow = apply(valid("열한 번째")).path("id").asText();
        mvc.perform(post("/api/admin/ads/{id}/approve", overflow).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(get("/api/ads")).andExpect(jsonPath("$.items", hasSize(10)));
    }

    @Test void limitsRapidApplications() throws Exception {
        String address = UUID.randomUUID().toString();
        for (int index = 0; index < 4; index++) {
            mvc.perform(post("/api/ads/apply").with(csrf()).with(request -> { request.setRemoteAddr(address); return request; })
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(valid("연속 " + index))))
                    .andExpect(status().is(index < 3 ? 201 : 429));
        }
    }

    private void approve(String id) throws Exception {
        mvc.perform(post("/api/admin/ads/{id}/approve", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isOk());
    }

    private JsonNode apply(ObjectNode input) throws Exception {
        return mapper.readTree(send(input).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private ResultActions send(ObjectNode input) throws Exception {
        return mvc.perform(post("/api/ads/apply").with(csrf()).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }

    private ObjectNode valid(String name) {
        return mapper.createObjectNode().put("siteName", name).put("tagline", "부업 자동화 도구").put("url", "https://example.com/")
                .put("contactEmail", "owner@example.com").put("color", "#3A86FF");
    }
}
