package kr.co.buchu.member;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import kr.co.buchu.security.ClientAddress;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:member-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "buchu.catalog-resource=classpath:programs-test.json"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test void ipHintsShortenAddressesLikeDc() {
        assertThat(ClientAddress.hint("118.235.12.34")).isEqualTo("118.235");
        assertThat(ClientAddress.hint("::1")).isEqualTo("127.0");
        assertThat(ClientAddress.hint("::ffff:10.0.0.9")).isEqualTo("10.0");
        assertThat(ClientAddress.hint("2001:db8:1234::1")).isEqualTo("2001:db8");
        assertThat(ClientAddress.hint("")).isEqualTo("0.0");
    }

    @Test void registerLoginMeAndLogoutRoundTrip() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/register").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(account("buchu_fan", "부추러"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.authenticated").value(true)).andExpect(jsonPath("$.member.nickname").value("부추러"));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(jsonPath("$.authenticated").value(true)).andExpect(jsonPath("$.member.username").value("buchu_fan"));
        mvc.perform(post("/api/auth/logout").with(csrf()).session(session)).andExpect(jsonPath("$.authenticated").value(false));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(jsonPath("$.authenticated").value(false));
        MockHttpSession fresh = new MockHttpSession();
        mvc.perform(post("/api/auth/login").with(csrf()).session(fresh).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"BUCHU_FAN\",\"password\":\"correct horse battery\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.member.nickname").value("부추러"));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"buchu_fan\",\"password\":\"wrong\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/posts").session(fresh)).andExpect(status().isForbidden());
    }

    @Test void rejectsBadOrDuplicateAccounts() throws Exception {
        register("buchu_fan", "부추러");
        for (ObjectNode input : List.of(account("buchu_fan", "다른닉"), account("other_one", "부추러"), account("ab", "닉네임"), account("Bad Id!", "닉네임"),
                account("good_id", "ㅇ"), account("good_id", "ㅇㅇ"), account("good_id", "관리자님"), account("good_id", "띄어 쓰기"), account("good_id", "가짜(1.2)"))) {
            mvc.perform(post("/api/auth/register").with(csrf()).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().is4xxClientError());
        }
        ObjectNode shortPassword = account("good_id", "닉네임"); shortPassword.put("password", "short");
        mvc.perform(post("/api/auth/register").with(csrf()).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; }).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(shortPassword))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(account("csrfless", "닉네임")))).andExpect(status().isForbidden());
    }

    @Test void anonymousPostsShowIpHintsAndMembersPostUnderTheirNickname() throws Exception {
        MvcResult anon = mvc.perform(post("/api/posts").with(csrf()).header("X-Forwarded-For", "118.235.12.34, 10.0.0.1")
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(postInput("익명 글"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.post.nickname").value("ㅇㅇ")).andExpect(jsonPath("$.post.ipHint").value("118.235"))
                .andExpect(jsonPath("$.post.authorType").value("ANON")).andExpect(jsonPath("$.post.mine").value(false)).andExpect(jsonPath("$.deleteToken").isString()).andReturn();
        JsonNode anonPost = mapper.readTree(anon.getResponse().getContentAsString());
        assertThat(anon.getResponse().getContentAsString()).doesNotContain("authorId");

        MockHttpSession session = register("buchu_fan", "부추러");
        MvcResult mine = mvc.perform(post("/api/posts").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(postInput("회원 글"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.post.nickname").value("부추러")).andExpect(jsonPath("$.post.authorType").value("MEMBER"))
                .andExpect(jsonPath("$.post.ipHint").doesNotExist()).andExpect(jsonPath("$.post.mine").value(true)).andExpect(jsonPath("$.deleteToken").doesNotExist()).andReturn();
        String mineId = mapper.readTree(mine.getResponse().getContentAsString()).path("post").path("id").asText();
        mvc.perform(get("/api/posts/{id}", mineId).session(session)).andExpect(jsonPath("$.mine").value(true));
        mvc.perform(get("/api/posts/{id}", mineId)).andExpect(jsonPath("$.mine").value(false));
        mvc.perform(get("/api/posts").session(session)).andExpect(jsonPath("$.items[0].mine").value(true)).andExpect(jsonPath("$.items[1].mine").value(false));

        mvc.perform(post("/api/posts/{id}/comments", mineId).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"내 댓글\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.comment.nickname").value("부추러")).andExpect(jsonPath("$.comment.mine").value(true));
        mvc.perform(post("/api/posts/{id}/comments", mineId).with(csrf()).header("X-Forwarded-For", "211.36.7.7").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"지나가던 사람\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.comment.nickname").value("ㅇㅇ")).andExpect(jsonPath("$.comment.ipHint").value("211.36"));

        // The member deletes with the session alone; strangers and other members cannot, and anonymous tokens still work.
        MockHttpSession other = register("someone_else", "딴사람");
        mvc.perform(delete("/api/posts/{id}", mineId).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/{id}", mineId).with(csrf()).session(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/{id}", mineId).with(csrf()).session(session)).andExpect(status().isNoContent());
        String anonId = anonPost.path("post").path("id").asText();
        mvc.perform(delete("/api/posts/{id}", anonId).with(csrf()).session(session)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/{id}", anonId).with(csrf()).header("X-Post-Token", anonPost.path("deleteToken").asText())).andExpect(status().isNoContent());
    }

    @Test void ageGroupIsOptionalAtSignupAndEditableLater() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/register").with(csrf()).session(session).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(account("age_tester", "나이대러").put("ageGroup", "thirties"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.member.ageGroup").value("THIRTIES"));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(jsonPath("$.member.ageGroup").value("THIRTIES"));
        mvc.perform(patch("/api/auth/profile").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"ageGroup\":\"FORTIES\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.member.ageGroup").value("FORTIES"));
        mvc.perform(patch("/api/auth/profile").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"ageGroup\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.member.ageGroup").value((Object) null));
        mvc.perform(patch("/api/auth/profile").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"ageGroup\":\"NINETIES\"}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/auth/profile").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"ageGroup\":\"FORTIES\"}")).andExpect(status().isUnauthorized());
        MockHttpSession plain = register("no_age", "무나이");
        mvc.perform(get("/api/auth/me").session(plain)).andExpect(jsonPath("$.member.ageGroup").value((Object) null));
    }

    private MockHttpSession register(String username, String nickname) throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/register").with(csrf()).session(session).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(account(username, nickname)))).andExpect(status().isCreated());
        return session;
    }

    private ObjectNode account(String username, String nickname) {
        return mapper.createObjectNode().put("username", username).put("password", "correct horse battery").put("nickname", nickname);
    }

    private ObjectNode postInput(String title) {
        return mapper.createObjectNode().put("category", "FREE").put("title", title).put("content", "회원과 익명이 함께 쓰는 글입니다.");
    }
}
