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

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:community-post-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "buchu.catalog-resource=classpath:programs-test.json",
        "STORAGE_PROVIDER=local", "STORAGE_LOCAL_DIR=build/test-uploads/community"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CommunityPostApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @Test void postIsPersistedAnonymouslyWithDeleteTokenAndViewCountGrowsOnRead() throws Exception {
        JsonNode created = create("FREE", "첫 글입니다");
        JsonNode post = created.path("post");
        assertThat(post.path("nickname").asText()).isEqualTo("ㅇㅇ");
        assertThat(created.path("deleteToken").asText()).hasSize(43);
        String hash = jdbc.queryForObject("SELECT delete_token_hash FROM community_posts WHERE id = ?", String.class, post.path("id").asText());
        assertThat(hash).hasSize(64).isNotEqualTo(created.path("deleteToken").asText());
        String listed = mvc.perform(get("/api/posts")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(post.path("id").asText()))
                .andExpect(jsonPath("$.items[0].viewCount").value(0))
                .andReturn().getResponse().getContentAsString();
        assertThat(listed).doesNotContain(hash, "deleteToken", "delete_token_hash");
        mvc.perform(get("/api/posts/{id}", post.path("id").asText())).andExpect(status().isOk()).andExpect(jsonPath("$.viewCount").value(1));
        mvc.perform(get("/api/posts/{id}", post.path("id").asText())).andExpect(jsonPath("$.viewCount").value(2));
        mvc.perform(get("/api/posts/{id}", "missing")).andExpect(status().isNotFound());
    }

    @Test void rejectsInvalidCategoryLengthsControlCharactersAndMissingCsrf() throws Exception {
        for (ObjectNode input : List.of(validInput("FREE", "제목").put("category", "SPAM"), validInput("FREE", "한"), validInput("FREE", "가".repeat(101)),
                validInput("FREE", "제목").put("content", "짧음"), validInput("FREE", "제목").put("content", "가".repeat(5001)),
                validInput("FREE", "제목").put("content", "허용되지 않는 문자\u0000입니다."), validInput("FREE", "제목").put("email", "person@example.com"))) {
            postInput(input).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(validInput("FREE", "제목"))))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_posts", Integer.class)).isZero();
    }

    @Test void listsFilterByCategorySearchAndSortByPopularity() throws Exception {
        JsonNode quiet = create("FREE", "조용한 글");
        JsonNode busy = create("TIP", "꿀팁 공유합니다");
        create("QUESTION", "질문 있어요");
        String busyId = busy.path("post").path("id").asText();
        comment(busyId, "도움이 됐어요");
        comment(busyId, "저도요");
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.items", hasSize(3)));
        mvc.perform(get("/api/posts").param("category", "TIP")).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].commentCount").value(2));
        mvc.perform(get("/api/posts").param("q", "꿀팁")).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value(busyId));
        mvc.perform(get("/api/posts").param("q", "100%_없음")).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/posts").param("sort", "popular")).andExpect(jsonPath("$.items[0].id").value(busyId));
        mvc.perform(get("/api/posts").param("sort", "latest").param("size", "1").param("page", "2"))
                .andExpect(jsonPath("$.items", hasSize(1))).andExpect(jsonPath("$.items[0].id").value(quiet.path("post").path("id").asText()));
        mvc.perform(get("/api/posts").param("category", "NOPE")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/posts").param("sort", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/posts").param("size", "101")).andExpect(status().isBadRequest());
    }

    @Test void homeFeedGroupsHotLatestAndPerTopicPosts() throws Exception {
        String stock = create("STOCK", "오늘 주식 어땠나요").path("post").path("id").asText();
        create("LOVE", "연애와 부업 병행");
        for (int index = 0; index < 6; index++) create("FREE", "자유 글 " + index);
        comment(stock, "오늘 좀 빠졌죠");
        mvc.perform(get("/api/posts/home")).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(8))
                .andExpect(jsonPath("$.popular[0].id").value(stock))
                .andExpect(jsonPath("$.latest[0].title").value("자유 글 5"))
                .andExpect(jsonPath("$.byCategory.FREE", hasSize(5)))
                .andExpect(jsonPath("$.byCategory.STOCK", hasSize(1)))
                .andExpect(jsonPath("$.byCategory.HEALTH", hasSize(0)));
        postInput(validInput("UNKNOWN", "분류 없음")).andExpect(status().isBadRequest());
    }

    @Test void commentsRequireAnExistingPostAndKeepTheCountInSync() throws Exception {
        String postId = create("QUESTION", "댓글 테스트").path("post").path("id").asText();
        mvc.perform(post("/api/posts/{id}/comments", "missing").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"없는 글\"}")).andExpect(status().isNotFound());
        mvc.perform(post("/api/posts/{id}/comments", postId).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"   \"}")).andExpect(status().isBadRequest());
        JsonNode first = comment(postId, "첫 댓글"), second = comment(postId, "둘째 댓글");
        assertThat(first.path("comment").path("nickname").asText()).isEqualTo("ㅇㅇ");
        mvc.perform(get("/api/posts/{id}/comments", postId)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(first.path("comment").path("id").asText()));
        mvc.perform(get("/api/posts/{id}", postId)).andExpect(jsonPath("$.commentCount").value(2));
        String commentId = second.path("comment").path("id").asText(), token = second.path("deleteToken").asText();
        mvc.perform(delete("/api/comments/{id}", commentId).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/{id}", commentId).with(csrf()).header("X-Post-Token", first.path("deleteToken").asText())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/{id}", commentId).header("X-Post-Token", token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/comments/{id}", commentId).with(csrf()).header("X-Post-Token", token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/{id}", postId)).andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(get("/api/posts/{id}/comments", "missing")).andExpect(status().isNotFound());
    }

    @Test void deletingAPostRequiresItsTokenAndRemovesComments() throws Exception {
        JsonNode created = create("FREE", "삭제될 글"), other = create("FREE", "다른 글");
        String id = created.path("post").path("id").asText(), token = created.path("deleteToken").asText();
        comment(id, "곧 사라질 댓글");
        mvc.perform(delete("/api/posts/{id}", id).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/{id}", id).with(csrf()).header("X-Post-Token", other.path("deleteToken").asText())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/{id}", id).header("X-Post-Token", token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/posts/{id}", id).with(csrf()).header("X-Post-Token", token)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/posts/{id}", id).with(csrf()).header("X-Post-Token", token)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_comments WHERE post_id = ?", Integer.class, id)).isZero();
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.total").value(1));
    }

    @Test void administratorCanModeratePostsAndCommentsButOthersCannot() throws Exception {
        String id = create("INCOME", "수익 인증").path("post").path("id").asText();
        String commentId = comment(id, "축하해요").path("comment").path("id").asText();
        mvc.perform(get("/api/admin/posts")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/posts").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/posts/{id}", id).with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/posts").with(user("admin").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(delete("/api/admin/comments/{id}", commentId).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/{id}", id)).andExpect(jsonPath("$.commentCount").value(0));
        mvc.perform(delete("/api/admin/posts/{id}", id).with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/posts/{id}", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/posts/{id}", id).with(user("admin").roles("ADMIN")).with(csrf())).andExpect(status().isNotFound());
    }

    @Test void photosAreUploadedThroughThePresignedContractShownEverywhereAndRemovedWithThePost() throws Exception {
        JsonNode first = uploadPhoto("png"), second = uploadPhoto("gif");
        assertThat(jdbc.queryForObject("SELECT scope FROM upload_assets WHERE id = ?", String.class, first.path("uploadId").asText())).isEqualTo("COMMUNITY");
        // Nothing is public before the photo is attached to a post.
        mvc.perform(get("/api/media/{id}", first.path("uploadId").asText())).andExpect(status().isNotFound());
        ObjectNode input = validInput("FREE", "사진 있는 글");
        input.set("images", mapper.createArrayNode().add(imageRef(first)).add(imageRef(second)));
        JsonNode created = mapper.readTree(postInput(input).andExpect(status().isCreated())
                .andExpect(jsonPath("$.post.images", hasSize(2)))
                .andExpect(jsonPath("$.post.images[0].id").value(first.path("uploadId").asText()))
                .andExpect(jsonPath("$.post.images[0].url").value("/api/media/" + first.path("uploadId").asText()))
                .andReturn().getResponse().getContentAsString());
        String id = created.path("post").path("id").asText();
        mvc.perform(get("/api/media/{id}", first.path("uploadId").asText())).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
        mvc.perform(get("/api/media/{id}", second.path("uploadId").asText())).andExpect(status().isOk()).andExpect(content().contentType("image/gif"));
        mvc.perform(get("/api/posts/{id}", id)).andExpect(jsonPath("$.images", hasSize(2))).andExpect(jsonPath("$.images[1].id").value(second.path("uploadId").asText()));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.items[0].images", hasSize(2)));
        mvc.perform(get("/api/posts/home")).andExpect(jsonPath("$.latest[0].images", hasSize(2))).andExpect(jsonPath("$.byCategory.FREE[0].images[0].url").value("/api/media/" + first.path("uploadId").asText()));
        create("FREE", "사진 없는 글");
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.items[0].images", hasSize(0)));
        // An attached photo cannot be attached again by another post, even with its secret.
        ObjectNode reuse = validInput("TIP", "남의 사진 재사용");
        reuse.set("images", mapper.createArrayNode().add(imageRef(first)));
        postInput(reuse).andExpect(status().isBadRequest());
        // Nor can it be discarded on its own once attached; it goes with the post.
        mvc.perform(delete("/api/posts/uploads/{id}", first.path("uploadId").asText()).with(csrf()).header("X-Upload-Token", first.path("uploadToken").asText())).andExpect(status().isConflict());
        mvc.perform(delete("/api/posts/{id}", id).with(csrf()).header("X-Post-Token", created.path("deleteToken").asText())).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM upload_assets WHERE id IN (?, ?)", Integer.class, first.path("uploadId").asText(), second.path("uploadId").asText())).isZero();
        mvc.perform(get("/api/media/{id}", first.path("uploadId").asText())).andExpect(status().isNotFound());
    }

    @Test void rejectsPhotosThatAreNotFinishedNotOwnedOrTooMany() throws Exception {
        JsonNode pending = presign("png");
        ObjectNode notFinished = validInput("FREE", "업로드 안 끝남");
        notFinished.set("images", mapper.createArrayNode().add(imageRef(pending)));
        postInput(notFinished).andExpect(status().isBadRequest());
        JsonNode done = uploadPhoto("png");
        ObjectNode wrongSecret = validInput("FREE", "비밀값 틀림");
        wrongSecret.set("images", mapper.createArrayNode().add(mapper.createObjectNode().put("uploadId", done.path("uploadId").asText()).put("token", "x".repeat(43))));
        postInput(wrongSecret).andExpect(status().isNotFound());
        ObjectNode duplicated = validInput("FREE", "같은 사진 두 번");
        duplicated.set("images", mapper.createArrayNode().add(imageRef(done)).add(imageRef(done)));
        postInput(duplicated).andExpect(status().isBadRequest());
        ObjectNode tooMany = validInput("FREE", "사진 여섯 장");
        var many = mapper.createArrayNode();
        for (int index = 0; index < 6; index++) many.add(imageRef(uploadPhoto("png")));
        tooMany.set("images", many);
        postInput(tooMany).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_posts", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM upload_assets WHERE published", Integer.class)).isZero();
        // A photo removed from the draft is discarded with its secret; without the secret nothing happens.
        JsonNode discarded = uploadPhoto("png");
        mvc.perform(delete("/api/posts/uploads/{id}", discarded.path("uploadId").asText()).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/uploads/{id}", discarded.path("uploadId").asText()).with(csrf()).header("X-Upload-Token", discarded.path("uploadToken").asText())).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM upload_assets WHERE id = ?", Integer.class, discarded.path("uploadId").asText())).isZero();
        // Only image types pass presign, the complete step needs the secret, and presign itself needs CSRF.
        mvc.perform(post("/api/posts/uploads/presign").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fileName\":\"a.svg\",\"contentType\":\"image/svg+xml\",\"size\":10}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/posts/uploads/{id}/complete", done.path("uploadId").asText()).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(post("/api/posts/uploads/presign").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fileName\":\"a.png\",\"contentType\":\"image/png\",\"size\":10}")).andExpect(status().isForbidden());
    }

    private static final byte[] PNG = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=");
    private static final byte[] GIF = java.util.Base64.getDecoder().decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    private JsonNode presign(String kind) throws Exception {
        byte[] bytes = kind.equals("gif") ? GIF : PNG;
        return mapper.readTree(mvc.perform(post("/api/posts/uploads/presign").with(csrf())
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(mapper.createObjectNode().put("fileName", "photo." + kind).put("contentType", "image/" + kind).put("size", bytes.length))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.uploadToken").isNotEmpty()).andReturn().getResponse().getContentAsString());
    }

    /** The browser's three steps: presign, PUT the bytes to the signed address, then confirm. Returns the presign body (upload id + secret). */
    private JsonNode uploadPhoto(String kind) throws Exception {
        byte[] bytes = kind.equals("gif") ? GIF : PNG;
        JsonNode signed = presign(kind);
        // The signed PUT is the one call exempt from CSRF; the capability lives in its URL, as in the browser.
        String uploadUrl = signed.path("uploadUrl").asText();
        mvc.perform(put(uploadUrl).servletPath(uploadUrl.substring(0, uploadUrl.indexOf('?'))).contentType("image/" + kind).content(bytes)).andExpect(status().isNoContent());
        mvc.perform(post("/api/posts/uploads/{id}/complete", signed.path("uploadId").asText()).with(csrf()).header("X-Upload-Token", signed.path("uploadToken").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.uploadId").value(signed.path("uploadId").asText()));
        return signed;
    }

    private ObjectNode imageRef(JsonNode signed) {
        return mapper.createObjectNode().put("uploadId", signed.path("uploadId").asText()).put("token", signed.path("uploadToken").asText());
    }

    @Test void limitsRapidAnonymousPosting() throws Exception {
        String address = UUID.randomUUID().toString();
        for (int index = 0; index < 6; index++) {
            mvc.perform(post("/api/posts").with(csrf()).with(request -> { request.setRemoteAddr(address); return request; })
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(validInput("FREE", "연속 작성 " + index))))
                    .andExpect(status().is(index < 5 ? 201 : 429));
        }
    }

    private JsonNode create(String category, String title) throws Exception {
        return mapper.readTree(postInput(validInput(category, title)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode comment(String postId, String content) throws Exception {
        return mapper.readTree(mvc.perform(post("/api/posts/{id}/comments", postId).with(csrf())
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(mapper.createObjectNode().put("content", content))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private ResultActions postInput(ObjectNode input) throws Exception {
        return mvc.perform(post("/api/posts").with(csrf())
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }

    private ObjectNode validInput(String category, String title) {
        return mapper.createObjectNode().put("category", category).put("title", title)
                .put("content", "부업을 시작하면서 궁금한 점과 경험을 함께 나눠요.");
    }
}
