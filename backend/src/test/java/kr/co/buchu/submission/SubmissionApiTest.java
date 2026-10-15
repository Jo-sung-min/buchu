package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import kr.co.buchu.storage.UploadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:submissions-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SubmissionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired SubmissionService submissions;
    @MockitoBean UploadService uploads;

    @BeforeEach void mediaUrls() {
        when(uploads.previewUrl(anyString())).thenAnswer(invocation -> "/api/media/" + invocation.getArgument(0) + "?token=private-preview");
        when(uploads.publicUrl(anyString())).thenAnswer(invocation -> "/api/media/" + invocation.getArgument(0));
    }

    @Test void capabilityTokenIsRequiredAndOnlyItsHashIsStored() throws Exception {
        Draft draft = draft();
        String hash = jdbc.queryForObject("SELECT access_token_hash FROM submissions WHERE id = ?", String.class, draft.id);
        assertThat(hash).hasSize(64).isNotEqualTo(draft.token);
        mvc.perform(get("/api/submissions/{id}", draft.id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/submissions/{id}", draft.id).header("X-Submission-Token", "z".repeat(43))).andExpect(status().isNotFound());
        mvc.perform(get("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.accessToken").doesNotExist()).andExpect(jsonPath("$.accessTokenHash").doesNotExist());
    }

    @Test void submitRequiresSavedFieldsAndDraftWritesRequireCsrf() throws Exception {
        mvc.perform(post("/api/submissions/drafts")).andExpect(status().isForbidden());
        Draft draft = draft();
        mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token)
                .contentType(MediaType.APPLICATION_JSON).content("{}")) .andExpect(status().isForbidden());
        mvc.perform(post("/api/submissions/{id}/submit", draft.id).header("X-Submission-Token", draft.token).with(csrf()))
                .andExpect(status().isBadRequest());
        save(draft, validInput());
        mvc.perform(get("/api/programs/partner-" + draft.id)).andExpect(status().isNotFound());
    }

    @Test void onlyApprovedProgramsBecomePublicAndContactDetailsStayPrivate() throws Exception {
        Draft draft = draft();
        ObjectNode input = validInput();
        input.set("content", mapper.readTree("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"상세한 프로그램 소개\"}]},{\"type\":\"image\",\"attrs\":{\"uploadId\":\"" + input.path("thumbnailUploadId").asText() + "\",\"src\":\"https://untrusted.example/image.png\",\"alt\":\"상품 이미지\"}}]}"));
        save(draft, input);
        submit(draft);
        mvc.perform(get("/api/programs/partner-" + draft.id)).andExpect(status().isNotFound());
        mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isConflict());
        mvc.perform(post("/api/admin/submissions/{id}/review", draft.id).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}")).andExpect(status().isForbidden());
        review(draft.id, "APPROVED", "등록 내용 확인 완료").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        var response = mvc.perform(get("/api/programs/partner-" + draft.id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.companyName").value("주식회사 새싹"))
                .andExpect(jsonPath("$.contactEmail").doesNotExist()).andExpect(jsonPath("$.businessNumber").doesNotExist())
                .andExpect(jsonPath("$.thumbnailUrl").value("/api/media/" + input.path("thumbnailUploadId").asText())).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("private@company.example", "비공개 담당자", "010-1234-5678", "private-preview", "untrusted.example", "access_token");
        mvc.perform(get("/api/programs").param("q", "새싹 리워드"))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].slug").value("partner-" + draft.id));
        mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isConflict());
        mvc.perform(post("/api/submissions/{id}/submit", draft.id).header("X-Submission-Token", draft.token).with(csrf())).andExpect(status().isConflict());
        review(draft.id, "REJECTED", "중복 심사").andExpect(status().isConflict());
    }

    @Test void rejectedApplicationCanBeEditedAndResubmittedWithAuditHistory() throws Exception {
        Draft draft = draft(); save(draft, validInput()); submit(draft);
        review(draft.id, "REJECTED", "  ").andExpect(status().isBadRequest());
        review(draft.id, "REJECTED", "정산 기준을 더 자세하게 적어 주세요.").andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewEvents", hasSize(1)));
        ObjectNode input = validInput().put("settlement", "월별 정산, 최소 출금액은 1만원입니다.");
        save(draft, input);
        mvc.perform(get("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token))
                .andExpect(jsonPath("$.reviewNote").value("정산 기준을 더 자세하게 적어 주세요."));
        submit(draft);
        mvc.perform(get("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token))
                .andExpect(jsonPath("$.reviewNote").isEmpty());
        review(draft.id, "APPROVED", "수정 확인").andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewEvents", hasSize(2)))
                .andExpect(jsonPath("$.reviewEvents[0].decision").value("REJECTED"))
                .andExpect(jsonPath("$.reviewEvents[1].reviewedBy").value("reviewer"));
    }

    @Test void legacySubmissionsDefaultToMarketerAndHelpPostsKeepBoardFieldsAfterApproval() throws Exception {
        Draft legacy = draft(); save(legacy, validInput());
        mvc.perform(get("/api/submissions/{id}", legacy.id).header("X-Submission-Token", legacy.token))
                .andExpect(jsonPath("$.board").value("MARKETER")).andExpect(jsonPath("$.helpType").isEmpty());
        Draft help = draft();
        ObjectNode input = validInput().put("board", "HELP").put("helpType", "RECRUITMENT")
                .put("location", "서울 · 원격 가능").put("deadline", "2027-01-31");
        save(help, input);
        assertThat(jdbc.queryForObject("SELECT board FROM submissions WHERE id = ?", String.class, help.id)).isEqualTo("HELP");
        submit(help);
        mvc.perform(get("/api/programs/partner-" + help.id)).andExpect(status().isNotFound());
        review(help.id, "APPROVED", "모집 조건 확인").andExpect(status().isOk());
        mvc.perform(get("/api/programs/partner-" + help.id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.board").value("HELP")).andExpect(jsonPath("$.helpType").value("RECRUITMENT"))
                .andExpect(jsonPath("$.location").value("서울 · 원격 가능")).andExpect(jsonPath("$.deadline").value("2027-01-31"))
                .andExpect(jsonPath("$.contactEmail").doesNotExist());
        mvc.perform(get("/api/programs").param("q", "새싹 리워드"))
                .andExpect(jsonPath("$.items[0].board").value("HELP"));
        mvc.perform(post("/api/programs/partner-" + help.id + "/reviews").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":5,\"title\":\"모집 평가입니다\",\"content\":\"모집 게시글에는 평가를 작성할 수 없습니다.\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/reviews").param("programSlug", "partner-" + help.id)).andExpect(status().isNotFound());
    }

    @Test void helpTypeDefaultsToPromotionAndBoardDatesAndLocationsAreValidated() throws Exception {
        Draft draft = draft();
        ObjectNode promotion = validInput().put("board", "HELP");
        save(draft, promotion);
        mvc.perform(get("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token))
                .andExpect(jsonPath("$.helpType").value("PROMOTION"));
        for (ObjectNode input : List.of(validInput().put("board", "UNKNOWN"),
                validInput().put("board", "HELP").put("helpType", "UNKNOWN"),
                validInput().put("deadline", "2027-02-30"), validInput().put("deadline", "2027-2-01"),
                validInput().put("location", "가".repeat(121)))) {
            mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isBadRequest());
        }
    }

    @Test void administrativeListIsAuthenticatedFilteredAndPaginated() throws Exception {
        Draft draft = draft(); save(draft, validInput()); submit(draft);
        mvc.perform(get("/api/admin/submissions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/submissions/{id}", draft.id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/submissions").with(user("admin").roles("ADMIN")).param("status", "ALL").param("q", "새싹").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.counts.PENDING").value(1));
        mvc.perform(get("/api/admin/submissions").with(user("admin").roles("ADMIN")).param("size", "1000")).andExpect(status().isBadRequest());
    }

    @Test void loginPersistsSessionRotatesCsrfAndLogoutInvalidatesAuthentication() throws Exception {
        mvc.perform(get("/api/admin/session")).andExpect(jsonPath("$.authenticated").value(false));
        var csrfResult = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode csrfToken = mapper.readTree(csrfResult.getResponse().getContentAsString());
        MockHttpSession session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        String beforeId = session.getId();
        mvc.perform(post("/api/admin/login").session(session).header(csrfToken.path("headerName").asText(), csrfToken.path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"test-admin\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/login").session(session).header(csrfToken.path("headerName").asText(), csrfToken.path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"test-admin\",\"password\":\"test-password-only\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authenticated").value(true));
        assertThat(session.getId()).isNotEqualTo(beforeId);
        mvc.perform(get("/api/admin/submissions").session(session)).andExpect(status().isOk());
        mvc.perform(post("/api/admin/logout").session(session).header(csrfToken.path("headerName").asText(), csrfToken.path("token").asText()))
                .andExpect(status().isForbidden());
        JsonNode fresh = mapper.readTree(mvc.perform(get("/api/auth/csrf").session(session)).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/admin/logout").session(session).header(fresh.path("headerName").asText(), fresh.path("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authenticated").value(false));
        mvc.perform(get("/api/admin/submissions")).andExpect(status().isUnauthorized());
    }

    @Test void rejectsUnsafeLinksRemoteImagesAndUnsupportedEditorElements() throws Exception {
        Draft draft = draft();
        for (String content : List.of(
                "{\"type\":\"doc\",\"content\":[{\"type\":\"script\"}]}",
                "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"src\":\"https://evil.example/x.png\"}}]}",
                "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"클릭\",\"marks\":[{\"type\":\"link\",\"attrs\":{\"href\":\"javascript:alert(1)\"}}]}]}]}",
                "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"style\":\"background:url(https://evil.example)\"}}]}")) {
            ObjectNode input = validInput(); input.set("content", mapper.readTree(content));
            mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isBadRequest());
        }
        ObjectNode input = validInput().put("officialUrl", "javascript:alert(1)");
        mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isBadRequest());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentReviewsHaveExactlyOneWinnerAndOneAuditEntry() throws Exception {
        Draft draft = draft();
        try {
            save(draft, validInput()); submit(draft);
            CountDownLatch start = new CountDownLatch(1);
            try (var executor = Executors.newFixedThreadPool(2)) {
                Callable<Integer> approve = () -> performReviewAfter(start, draft.id, "APPROVED");
                Callable<Integer> reject = () -> performReviewAfter(start, draft.id, "REJECTED");
                var first = executor.submit(approve); var second = executor.submit(reject);
                start.countDown();
                assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM review_events WHERE submission_id = ?", Integer.class, draft.id)).isEqualTo(1);
        } finally {
            jdbc.update("DELETE FROM review_events WHERE submission_id = ?", draft.id);
            jdbc.update("DELETE FROM submissions WHERE id = ?", draft.id);
        }
    }

    private int performReviewAfter(CountDownLatch start, String id, String decision) throws InterruptedException {
        start.await();
        try { submissions.review(id, new SubmissionService.ReviewInput(decision, "동시 검토"), "concurrent-reviewer"); return 200; }
        catch (ResponseStatusException exception) { return exception.getStatusCode().value(); }
    }

    private Draft draft() throws Exception {
        JsonNode data = mapper.readTree(mvc.perform(post("/api/submissions/drafts").with(csrf()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return new Draft(data.path("id").asText(), data.path("accessToken").asText());
    }

    private void save(Draft draft, ObjectNode input) throws Exception {
        mvc.perform(put("/api/submissions/{id}", draft.id).header("X-Submission-Token", draft.token).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk());
    }

    private void submit(Draft draft) throws Exception {
        mvc.perform(post("/api/submissions/{id}/submit", draft.id).header("X-Submission-Token", draft.token).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
    }

    private org.springframework.test.web.servlet.ResultActions review(String id, String decision, String note) throws Exception {
        return mvc.perform(post("/api/admin/submissions/{id}/review", id).with(user("reviewer").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(new SubmissionService.ReviewInput(decision, note))));
    }

    private ObjectNode validInput() throws Exception {
        ObjectNode input = mapper.createObjectNode().put("companyName", "주식회사 새싹").put("businessNumber", "123-45-67890")
                .put("contactName", "비공개 담당자").put("contactEmail", "private@company.example").put("contactPhone", "010-1234-5678")
                .put("name", "새싹 리워드").put("tagline", "추천하는 즐거움").put("description", "링크를 공유하는 제휴 프로그램입니다.")
                .put("officialUrl", "https://company.example/partners").put("category", "affiliate").put("cost", "free")
                .put("costLabel", "무료 가입").put("commission", "구매 건별 정해진 수수료").put("settlement", "월별 정산")
                .put("thumbnailUploadId", UUID.randomUUID().toString());
        input.putArray("channels").add("blog").add("sns"); input.putArray("tags").add("쇼핑");
        input.set("content", mapper.readTree("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"상세한 프로그램 소개\"}]}]}"));
        return input;
    }

    private record Draft(String id, String token) {}
}
