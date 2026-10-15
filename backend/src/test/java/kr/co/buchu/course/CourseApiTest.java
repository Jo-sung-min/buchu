package kr.co.buchu.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:course-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "buchu.catalog-resource=classpath:programs-test.json"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CourseApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired CourseService courses;

    @Test void seededConceptsAreClearlyNonSaleableAndNeverLeakLessonContentsInCatalog() throws Exception {
        String response = mvc.perform(get("/api/courses")).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(6)).andExpect(jsonPath("$.items", hasSize(6)))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("\"body\"", "\"videoUrl\"");
        for (JsonNode course : mapper.readTree(response).path("items")) {
            assertThat(course.path("status").asText()).isEqualTo("COMING_SOON");
            assertThat(course.path("isDemo").asBoolean()).isTrue();
            assertThat(course.path("price").asInt()).isZero();
            assertThat(course.path("instructorName").asText()).isEqualTo("부추 기획팀");
            assertThatThrownBy(() -> courses.findPublishedById(course.path("id").asText())).isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test void draftAndArchivedCatalogArePrivateAndAdminCanInspectFullCurriculum() throws Exception {
        JsonNode draft = create(input("private-draft", "DRAFT"));
        JsonNode archived = create(input("private-archived", "ARCHIVED"));
        for (JsonNode course : List.of(draft, archived)) {
            mvc.perform(get("/api/courses/{slug}", course.path("slug").asText())).andExpect(status().isNotFound());
            mvc.perform(get("/api/courses/{slug}/lessons/preview-one/preview", course.path("slug").asText())).andExpect(status().isNotFound());
        }
        mvc.perform(get("/api/courses")).andExpect(jsonPath("$.total").value(6));
        String admin = mvc.perform(get("/api/admin/courses").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.total").value(8)).andReturn().getResponse().getContentAsString();
        assertThat(admin).contains("private-draft", "유료 수업에서만 제공하는 실제 학습 본문입니다.", "https://media.example.com/paid.mp4");
    }

    @Test void publicCatalogContainsMetadataOnlyAndPreviewCannotFetchPaidLesson() throws Exception {
        JsonNode course = create(input("public-course", "PUBLISHED"));
        String detail = mvc.perform(get("/api/courses/public-course")).andExpect(status().isOk())
                .andExpect(jsonPath("$.price").value(39000)).andExpect(jsonPath("$.curriculum[0].lessons", hasSize(2)))
                .andReturn().getResponse().getContentAsString();
        assertThat(detail).doesNotContain("\"body\"", "\"videoUrl\"", "paid.mp4", "미리보기 학습 내용", "유료 수업에서만");
        mvc.perform(get("/api/courses/public-course/lessons/preview-one/preview"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.body").value("미리보기 학습 내용을 차근차근 설명하는 실제 텍스트입니다."));
        mvc.perform(get("/api/courses/public-course/lessons/paid-two/preview")).andExpect(status().isNotFound());
        mvc.perform(get("/api/courses/public-course/lessons/missing/preview")).andExpect(status().isNotFound());
        assertThat(courses.findPublishedById(course.path("id").asText()).price()).isEqualTo(39000);
    }

    @Test void publishedCourseRequiresRealContentAndDisclosuresBeforeAcceptingSales() throws Exception {
        for (ObjectNode invalid : List.of(
                input("bad-demo", "PUBLISHED").put("isDemo", true),
                input("bad-price", "PUBLISHED").put("price", 0),
                input("bad-bio", "PUBLISHED").put("instructorBio", ""),
                input("bad-teacher", "PUBLISHED").put("instructorName", ""),
                input("bad-description", "PUBLISHED").put("description", "짧은 소개"),
                input("bad-refund", "PUBLISHED").put("refundPolicy", ""),
                input("bad-contact", "PUBLISHED").put("supportEmail", ""))) {
            postInput(invalid).andExpect(status().isBadRequest());
        }
        ObjectNode noOutcomes = input("bad-outcomes", "PUBLISHED"); noOutcomes.set("outcomes", mapper.createArrayNode());
        postInput(noOutcomes).andExpect(status().isBadRequest());
        ObjectNode noRequirements = input("bad-requirements", "PUBLISHED"); noRequirements.set("requirements", mapper.createArrayNode());
        postInput(noRequirements).andExpect(status().isBadRequest());
        ObjectNode noModules = input("bad-modules", "PUBLISHED"); noModules.set("curriculum", mapper.createArrayNode());
        postInput(noModules).andExpect(status().isBadRequest());
        ObjectNode noLessons = input("bad-lessons", "PUBLISHED"); ((ObjectNode) noLessons.path("curriculum").get(0)).set("lessons", mapper.createArrayNode());
        postInput(noLessons).andExpect(status().isBadRequest());
        ObjectNode noContent = input("bad-content", "PUBLISHED"); paidLesson(noContent).put("body", "").put("videoUrl", "");
        postInput(noContent).andExpect(status().isBadRequest());
        ObjectNode videoOnly = input("video-content", "PUBLISHED"); paidLesson(videoOnly).put("body", "");
        postInput(videoOnly).andExpect(status().isCreated());
    }

    @Test void strictNumbersRejectDecimalsStringsNullAndOutOfRangeValues() throws Exception {
        for (String name : List.of("price", "accessDays", "weeklyHours", "startupCost")) {
            for (JsonNode value : List.of(mapper.readTree("1.5"), mapper.readTree("\"2\""), mapper.nullNode(), mapper.readTree("2147483648"))) {
                ObjectNode invalid = input("numeric-course", "DRAFT"); invalid.set(name, value);
                postInput(invalid).andExpect(status().isBadRequest());
            }
        }
        for (ObjectNode invalid : List.of(input("bad-course", "DRAFT").put("price", -1), input("bad-course", "DRAFT").put("price", 10000001),
                input("bad-course", "DRAFT").put("accessDays", 0), input("bad-course", "DRAFT").put("accessDays", 3651),
                input("bad-course", "DRAFT").put("weeklyHours", 169), input("bad-course", "DRAFT").put("startupCost", 100000001))) {
            postInput(invalid).andExpect(status().isBadRequest());
        }
        ObjectNode duration = input("bad-course", "DRAFT"); paidLesson(duration).put("durationMinutes", 2.5);
        postInput(duration).andExpect(status().isBadRequest());
        paidLesson(duration).put("durationMinutes", 601); postInput(duration).andExpect(status().isBadRequest());
        paidLesson(duration).putNull("durationMinutes"); postInput(duration).andExpect(status().isBadRequest());
        ObjectNode booleanString = input("bad-course", "DRAFT").put("isDemo", "false");
        postInput(booleanString).andExpect(status().isBadRequest());
    }

    @Test void rejectsInvalidTaxonomySlugsMarkupAndUnsafeMediaUrls() throws Exception {
        for (ObjectNode invalid : List.of(input("bad-course", "DRAFT").put("category", "OTHER"), input("bad-course", "DRAFT").put("level", "PRO"),
                input("bad-course", "DRAFT").put("status", "APPROVED"), input("../bad", "DRAFT"), input("Bad-Course", "DRAFT"),
                input("bad-course", "DRAFT").put("supportEmail", "not-email"), input("bad-course", "DRAFT").put("title", "<script>alert(1)</script>"))) {
            postInput(invalid).andExpect(status().isBadRequest());
        }
        for (String url : List.of("javascript:alert(1)", "http://example.com/image.png", "https://localhost/file", "https://127.0.0.1/file", "https://192.168.1.2/file", "https://name:secret@example.com/image.png", "https://example.com:8080/image.png")) {
            postInput(input("bad-url", "DRAFT").put("thumbnailUrl", url)).andExpect(status().isBadRequest());
            ObjectNode invalid = input("bad-url", "DRAFT"); paidLesson(invalid).put("videoUrl", url);
            postInput(invalid).andExpect(status().isBadRequest());
        }
        ObjectNode html = input("bad-body", "DRAFT"); paidLesson(html).put("body", "<iframe src='https://example.com'></iframe>");
        postInput(html).andExpect(status().isBadRequest());
        postInput(input("safe-url", "DRAFT").put("thumbnailUrl", "https://images.example.com/cover.webp")).andExpect(status().isCreated());
    }

    @Test void rejectsDuplicateLessonIdentifiersAcrossModulesAndOversizedCurricula() throws Exception {
        ObjectNode duplicate = input("duplicate-lessons", "DRAFT");
        ((ArrayNode) duplicate.path("curriculum")).add(duplicate.path("curriculum").get(0).deepCopy());
        ((ObjectNode) duplicate.path("curriculum").get(1)).put("id", "second-module");
        postInput(duplicate).andExpect(status().isBadRequest());
        ObjectNode tooMany = input("many-modules", "DRAFT");
        ArrayNode modules = mapper.createArrayNode();
        for (int index = 0; index < 31; index++) modules.add(mapper.createObjectNode().put("id", "module-" + index).put("title", "챕터").set("lessons", mapper.createArrayNode()));
        tooMany.set("curriculum", modules); postInput(tooMany).andExpect(status().isBadRequest());
    }

    @Test void uniqueSlugIsEnforcedOnCreateAndUpdateWithoutChangingExistingCourse() throws Exception {
        JsonNode first = create(input("unique-course", "DRAFT"));
        JsonNode second = create(input("other-course", "DRAFT"));
        postInput(input("unique-course", "DRAFT")).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/courses/{id}", second.path("id").asText()).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input("unique-course", "DRAFT"))))
                .andExpect(status().isConflict());
        assertThat(courses.findById(first.path("id").asText()).slug()).isEqualTo("unique-course");
        assertThat(courses.findById(second.path("id").asText()).slug()).isEqualTo("other-course");
    }

    @Test void archivingRemovesPublicPreviewWhilePreservingInternalPaidAccessById() throws Exception {
        JsonNode original = create(input("archive-course", "PUBLISHED"));
        String id = original.path("id").asText();
        mvc.perform(put("/api/admin/courses/{id}", id).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input("archive-course", "ARCHIVED"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.createdAt").value(original.path("createdAt").asText()));
        mvc.perform(get("/api/courses/archive-course")).andExpect(status().isNotFound());
        mvc.perform(get("/api/courses/archive-course/lessons/preview-one/preview")).andExpect(status().isNotFound());
        assertThat(courses.lessonForCourse(id, "paid-two").body()).contains("유료 수업에서만");
        assertThatThrownBy(() -> courses.findPublishedById(id)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void administratorRoleAndCsrfAreRequiredForPrivateContentAndMutations() throws Exception {
        String content = mapper.writeValueAsString(input("security-course", "DRAFT"));
        mvc.perform(get("/api/admin/courses")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/courses").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/courses").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/courses").with(user("member").roles("USER")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/courses").with(user("admin").roles("ADMIN")).contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isForbidden());
        JsonNode created = create(input("security-course", "DRAFT"));
        mvc.perform(put("/api/admin/courses/{id}", created.path("id").asText()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/courses/missing").with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isNotFound());
    }

    private JsonNode create(ObjectNode input) throws Exception {
        return mapper.readTree(postInput(input).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }
    private ResultActions postInput(ObjectNode input) throws Exception {
        return mvc.perform(post("/api/admin/courses").with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }
    private ObjectNode paidLesson(ObjectNode input) { return (ObjectNode) input.path("curriculum").get(0).path("lessons").get(1); }
    private ObjectNode input(String slug, String status) {
        ObjectNode value = mapper.createObjectNode().put("slug", slug).put("title", "실무에 적용하는 부업 강의")
                .put("subtitle", "작은 결과물을 완성하는 수업")
                .put("description", "실제 학습 결과물을 만들기 위해 필요한 과정과 준비 사항을 설명합니다.")
                .put("category", "AFFILIATE").put("level", "BEGINNER").put("status", status).put("isDemo", false)
                .put("instructorName", "테스트 강사").put("instructorBio", "실제 경험을 바탕으로 학습 과정을 안내하는 강사입니다.")
                .put("thumbnailUrl", "").put("refundPolicy", "결제 전에 확인할 수 있는 환불 조건과 문의 절차를 자세히 안내합니다.")
                .put("supportEmail", "teacher@example.com").put("price", 39000).put("accessDays", 365).put("weeklyHours", 3).put("startupCost", 0)
                .putNull("relatedProgramSlug");
        value.set("outcomes", mapper.createArrayNode().add("실행할 수 있는 부업 계획서"));
        value.set("requirements", mapper.createArrayNode().add("인터넷과 문서 편집 도구"));
        ArrayNode lessons = mapper.createArrayNode();
        lessons.add(mapper.createObjectNode().put("id", "preview-one").put("title", "첫 미리보기").put("durationMinutes", 10).put("preview", true)
                .put("body", "미리보기 학습 내용을 차근차근 설명하는 실제 텍스트입니다.").put("videoUrl", ""));
        lessons.add(mapper.createObjectNode().put("id", "paid-two").put("title", "실전 연습").put("durationMinutes", 20).put("preview", false)
                .put("body", "유료 수업에서만 제공하는 실제 학습 본문입니다.").put("videoUrl", "https://media.example.com/paid.mp4"));
        value.set("curriculum", mapper.createArrayNode().add(mapper.createObjectNode().put("id", "module-one").put("title", "시작하기").set("lessons", lessons)));
        return value;
    }
}
