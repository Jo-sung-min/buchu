package kr.co.buchu.community;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:anonymous-review-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "buchu.catalog-resource=classpath:programs-test.json"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AnonymousReviewApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @Test void anonymousReviewIsPersistedWithOneTimeDeleteTokenAndNoIdentityFields() throws Exception {
        JsonNode created = create("featured-program", 4);
        JsonNode review = created.path("review");
        assertThat(review.path("nickname").asText()).matches("익명[0-9a-f]{6}");
        assertThat(review.path("programName").asText()).isEqualTo("쿠팡 테스트");
        String hash = jdbc.queryForObject("SELECT delete_token_hash FROM anonymous_reviews WHERE id = ?", String.class, review.path("id").asText());
        assertThat(hash).hasSize(64).isNotEqualTo(created.path("deleteToken").asText());
        assertThat(created.path("deleteToken").asText()).hasSize(43);
        String listed = mvc.perform(get("/api/reviews")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(review.path("id").asText()))
                .andReturn().getResponse().getContentAsString();
        assertThat(listed).doesNotContain(hash, created.path("deleteToken").asText(), "deleteToken", "delete_token_hash", "email", "ipAddress");
    }

    @Test void rejectsInvalidRatingsLengthsControlCharactersAndExtraIdentityFields() throws Exception {
        for (JsonNode rating : List.of(mapper.readTree("0"), mapper.readTree("6"), mapper.readTree("1.5"), mapper.readTree("\"5\""), mapper.nullNode())) {
            ObjectNode input = validInput(5); input.set("rating", rating);
            postInput("featured-program", input).andExpect(status().isBadRequest());
        }
        for (ObjectNode input : List.of(validInput(5).put("title", "짧음"), validInput(5).put("title", "가".repeat(81)),
                validInput(5).put("content", "내용 짧음"), validInput(5).put("content", "가".repeat(2001)),
                validInput(5).put("content", "허용되지 않는 문자\u0000입니다."), validInput(5).put("email", "person@example.com"))) {
            postInput("featured-program", input).andExpect(status().isBadRequest());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM anonymous_reviews", Integer.class)).isZero();
    }

    @Test void onlyPublishedProgramsCanReceiveReviewsAndCreationRequiresCsrf() throws Exception {
        postInput("missing-program", validInput(5)).andExpect(status().isNotFound());
        mvc.perform(post("/api/programs/featured-program/reviews").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(validInput(5)))).andExpect(status().isForbidden());
        mvc.perform(get("/api/reviews").param("programSlug", "missing-program")).andExpect(status().isNotFound());
    }

    @Test void listsWithStableRatingSortPaginationAndWeightedSummary() throws Exception {
        create("featured-program", 2);
        create("featured-program", 5);
        create("alpha-program", 3);
        mvc.perform(get("/api/reviews").param("sort", "rating_desc").param("size", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].rating").value(5)).andExpect(jsonPath("$.items[1].rating").value(3));
        mvc.perform(get("/api/reviews").param("sort", "rating_desc").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.items", hasSize(1))).andExpect(jsonPath("$.items[0].rating").value(2));
        mvc.perform(get("/api/reviews").param("programSlug", "featured-program"))
                .andExpect(jsonPath("$.total").value(2));
        mvc.perform(get("/api/reviews/summary"))
                .andExpect(jsonPath("$.totalReviews").value(3)).andExpect(jsonPath("$.averageRating").value(3.3))
                .andExpect(jsonPath("$.programs[?(@.programSlug=='featured-program')].reviewCount").value(2))
                .andExpect(jsonPath("$.programs[?(@.programSlug=='featured-program')].averageRating").value(3.5))
                .andExpect(jsonPath("$.programs[?(@.programSlug=='campaign-program')].reviewCount").value(0));
    }

    @Test void deletionRequiresMatchingCapabilityAndCsrfAndUpdatesSummary() throws Exception {
        JsonNode first = create("featured-program", 5), other = create("alpha-program", 2);
        String id = first.path("review").path("id").asText(), token = first.path("deleteToken").asText();
        mvc.perform(delete("/api/reviews/{id}", id).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/reviews/{id}", id).with(csrf()).header("X-Review-Token", other.path("deleteToken").asText()))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/reviews/{id}", id).header("X-Review-Token", token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/reviews/{id}", id).with(csrf()).header("X-Review-Token", token)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/reviews/{id}", id).with(csrf()).header("X-Review-Token", token)).andExpect(status().isNotFound());
        mvc.perform(get("/api/reviews/summary")).andExpect(jsonPath("$.totalReviews").value(1)).andExpect(jsonPath("$.averageRating").value(2.0));
    }

    @Test void administratorCanModerateReviewsButUnauthenticatedAndNonAdminUsersCannot() throws Exception {
        JsonNode created = create("featured-program", 5);
        String id = created.path("review").path("id").asText();
        mvc.perform(get("/api/admin/reviews")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/reviews").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/reviews/{id}", id).with(csrf())).andExpect(status().isUnauthorized());
        String listed = mvc.perform(get("/api/admin/reviews").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id)).andReturn().getResponse().getContentAsString();
        assertThat(listed).doesNotContain("deleteToken", "delete_token_hash", created.path("deleteToken").asText());
        mvc.perform(delete("/api/admin/reviews/{id}", id).with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/reviews/{id}", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/reviews")).andExpect(jsonPath("$.total").value(0));
    }

    @Test void publicListHidesUnavailableProgramsAndAdminCanRemoveTheirReviews() throws Exception {
        JsonNode created = create("featured-program", 5);
        String id = created.path("review").path("id").asText();
        jdbc.update("UPDATE anonymous_reviews SET program_slug = 'removed-program' WHERE id = ?", id);
        mvc.perform(get("/api/reviews")).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/reviews/summary")).andExpect(jsonPath("$.totalReviews").value(0));
        mvc.perform(get("/api/admin/reviews").with(user("admin").roles("ADMIN"))).andExpect(jsonPath("$.total").value(1));
        mvc.perform(delete("/api/admin/reviews/{id}", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isNoContent());
    }

    @Test void rejectsBadPaginationAndSortAndLimitsRapidAnonymousPosting() throws Exception {
        for (String parameter : List.of("page", "size")) {
            mvc.perform(get("/api/reviews").param(parameter, "-1")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/reviews").param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/reviews").param("sort", "invalid")).andExpect(status().isBadRequest());
        String address = UUID.randomUUID().toString();
        for (int index = 0; index < 6; index++) {
            mvc.perform(post("/api/programs/featured-program/reviews").with(csrf())
                    .with(request -> { request.setRemoteAddr(address); return request; })
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(validInput(5))))
                    .andExpect(status().is(index < 5 ? 201 : 429));
        }
    }

    private JsonNode create(String slug, int rating) throws Exception {
        return mapper.readTree(postInput(slug, validInput(rating)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private ResultActions postInput(String slug, ObjectNode input) throws Exception {
        return mvc.perform(post("/api/programs/{slug}/reviews", slug).with(csrf())
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }

    private ObjectNode validInput(int rating) {
        return mapper.createObjectNode().put("rating", rating).put("title", "직접 사용한 평가입니다")
                .put("content", "참여 절차를 확인하고 직접 이용해 본 경험을 공유합니다.");
    }
}
