package kr.co.buchu.storage;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.co.buchu.api.ApiExceptionHandler;
import kr.co.buchu.submission.SubmissionAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UploadServiceTest {
    private static final String SUBMISSION = "00000000-0000-0000-0000-000000000001";
    private static final String OWNER_TOKEN = "owner-secret";
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=");
    @TempDir Path temp;
    private JdbcTemplate jdbc;
    private SubmissionAccessService access;
    private UploadService uploads;

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:uploads-" + UUID.randomUUID()
                + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__upload_assets.sql"),
                new ClassPathResource("db/migration/V13__upload_asset_scope.sql")).execute(source);
        jdbc.execute("CREATE TABLE submissions (id VARCHAR(36) PRIMARY KEY, status VARCHAR(16) NOT NULL)");
        jdbc.update("INSERT INTO submissions (id, status) VALUES (?, 'DRAFT')", SUBMISSION);
        access = mock(SubmissionAccessService.class);
        var properties = new StorageProperties("local", temp.toString(), "", "ap-northeast-2", "", false, "");
        uploads = new UploadService(jdbc, access, new LocalObjectStorage(temp.toString()), properties);
    }

    @Test
    void completesImageIdempotentlyAndRequiresReadCapabilityUntilPublished() {
        var signed = presign();
        upload(signed, PNG);
        var complete = uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId());
        assertThat(complete.objectKey()).startsWith("private/").isNotEqualTo(signed.objectKey());
        assertThat(uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId())).isEqualTo(complete);
        assertStatus(404, () -> uploads.media(signed.uploadId(), null));
        assertStatus(404, () -> uploads.media(signed.uploadId(), "incorrect"));
        assertStatus(404, () -> uploads.media(signed.uploadId(), capability(signed.uploadUrl())));
        assertStatus(404, () -> uploads.publicUrl(signed.uploadId()));
        assertThat(uploads.media(signed.uploadId(), capability(complete.url())).bytes()).isEqualTo(PNG);
        uploads.publish(SUBMISSION, List.of(signed.uploadId()));
        assertThat(uploads.publicUrl(signed.uploadId())).isEqualTo("/api/media/" + signed.uploadId());
        assertThat(uploads.media(signed.uploadId(), null).bytes()).isEqualTo(PNG);
        assertThat(uploads.media(signed.uploadId(), null).published()).isTrue();
        assertThat(temp.resolve(signed.objectKey())).doesNotExist();
    }

    @Test
    void deniesUnauthorizedOwnersAndInvalidUploadCapabilities() {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "권한 없음"))
                .when(access).requireEditable(SUBMISSION, "wrong");
        assertStatus(403, () -> uploads.presign(SUBMISSION, "wrong", request()));
        var signed = presign();
        assertStatus(403, () -> uploads.complete(SUBMISSION, "wrong", signed.uploadId()));
        assertStatus(404, () -> uploads.uploadLocal(signed.uploadId(), "wrong", "image/png", PNG.length,
                new ByteArrayInputStream(PNG)));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM upload_assets", Integer.class)).isEqualTo(1);
    }

    @Test
    void enforcesAllowedTypesDeclaredSizeAndActualBytes() {
        assertStatus(400, () -> uploads.presign(SUBMISSION, OWNER_TOKEN,
                new UploadService.PresignRequest("payload.svg", "image/svg+xml", 50)));
        assertStatus(400, () -> uploads.presign(SUBMISSION, OWNER_TOKEN,
                new UploadService.PresignRequest("too-big.png", "image/png", ImageFiles.MAX_SIZE + 1)));
        var signed = presign();
        assertStatus(400, () -> uploads.uploadLocal(signed.uploadId(), capability(signed.uploadUrl()), "image/jpeg",
                PNG.length, new ByteArrayInputStream(PNG)));
        assertStatus(400, () -> upload(signed, new byte[PNG.length]));
        assertStatus(413, () -> uploads.uploadLocal(signed.uploadId(), capability(signed.uploadUrl()), "image/png", -1,
                new ByteArrayInputStream(new byte[PNG.length + 1])));
        assertStatus(400, () -> uploads.uploadLocal(signed.uploadId(), capability(signed.uploadUrl()), "image/png", -1,
                new ByteArrayInputStream(new byte[PNG.length - 1])));
        assertStatus(409, () -> uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId()));
    }

    @Test
    void rejectsExpiredUploadsAndNoLongerEditableSubmissions() {
        var expired = presign();
        jdbc.update("UPDATE upload_assets SET expires_at = ? WHERE id = ?", Timestamp.from(Instant.now().minusSeconds(1)),
                expired.uploadId());
        assertStatus(410, () -> upload(expired, PNG));
        assertStatus(410, () -> uploads.complete(SUBMISSION, OWNER_TOKEN, expired.uploadId()));
        var waiting = presign();
        jdbc.update("UPDATE submissions SET status = 'PENDING' WHERE id = ?", SUBMISSION);
        assertStatus(409, () -> upload(waiting, PNG));
    }

    @Test
    void completedImageCannotBeOverwrittenByReusingPresignedPut() {
        var signed = presign();
        upload(signed, PNG);
        uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId());
        assertStatus(409, () -> upload(signed, PNG));
        uploads.validateReady(SUBMISSION, List.of(signed.uploadId()));
        assertStatus(400, () -> uploads.validateReady("different-submission", List.of(signed.uploadId())));
        var pending = presign();
        assertStatus(400, () -> uploads.validateReady(SUBMISSION, List.of(pending.uploadId())));
    }

    @Test
    void capsActiveImagesAtTwentyButAllowsReplacementForExpiredIncompleteRequests() {
        for (int count = 0; count < 20; count++) presign();
        assertStatus(409, this::presign);
        jdbc.update("UPDATE upload_assets SET expires_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        assertThat(presign().uploadId()).isNotBlank();
    }

    @Test
    void mediaHasPrivateCacheAndNosniffHeadersUntilPublication() throws Exception {
        var signed = presign();
        upload(signed, PNG);
        var complete = uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId());
        var mvc = MockMvcBuilders.standaloneSetup(new StorageController(uploads))
                .setControllerAdvice(new ApiExceptionHandler()).build();
        mvc.perform(get(complete.url())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        mvc.perform(get("/api/media/" + signed.uploadId())).andExpect(status().isNotFound());
        uploads.publish(SUBMISSION, List.of(signed.uploadId()));
        mvc.perform(get("/api/media/" + signed.uploadId())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=86400, immutable"));
    }

    @Test
    void remoteCompletionUsesVerifiedEtagAndSeparateImmutableKeysBeforeCdnPublication() {
        ObjectStorage remote = mock(ObjectStorage.class);
        when(remote.remote()).thenReturn(true);
        when(remote.presign(anyString(), anyString(), anyLong(), any()))
                .thenReturn(new ObjectStorage.PresignedTarget("https://storage.example/signed-put", Map.of("Content-Type", "image/png")));
        when(remote.inspect(anyString())).thenReturn(new ObjectStorage.VerifiedObject(PNG.length, "image/png", PNG, "etag-1"));
        uploads = new UploadService(jdbc, access, remote,
                new StorageProperties("s3", temp.toString(), "test-bucket", "ap-northeast-2", "", false, "https://cdn.example/"));
        var signed = presign();
        assertThat(signed.objectKey()).startsWith("staging/");
        var complete = uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId());
        verify(remote).copy(signed.objectKey(), complete.objectKey(), "etag-1");
        assertStatus(404, () -> uploads.publicUrl(signed.uploadId()));
        uploads.publish(SUBMISSION, List.of(signed.uploadId()));
        String publicUrl = uploads.publicUrl(signed.uploadId());
        assertThat(publicUrl).startsWith("https://cdn.example/published/").doesNotContain("private/");
        String publishedKey = publicUrl.substring("https://cdn.example/".length());
        verify(remote).copy(complete.objectKey(), publishedKey, "etag-1");
    }

    @Test
    void remoteCompletionRejectsUntrustedMetadataAndInvalidImageSignatures() {
        ObjectStorage remote = mock(ObjectStorage.class);
        when(remote.remote()).thenReturn(true);
        when(remote.presign(anyString(), anyString(), anyLong(), any()))
                .thenReturn(new ObjectStorage.PresignedTarget("https://storage.example/signed-put", Map.of()));
        uploads = new UploadService(jdbc, access, remote,
                new StorageProperties("s3", temp.toString(), "test-bucket", "ap-northeast-2", "", false, ""));
        var signed = presign();
        when(remote.inspect(anyString())).thenReturn(new ObjectStorage.VerifiedObject(PNG.length + 1, "image/png", PNG, "etag"));
        assertStatus(400, () -> uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId()));
        when(remote.inspect(anyString())).thenReturn(new ObjectStorage.VerifiedObject(PNG.length, "text/html", PNG, "etag"));
        assertStatus(400, () -> uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId()));
        when(remote.inspect(anyString())).thenReturn(new ObjectStorage.VerifiedObject(PNG.length, "image/png", new byte[32], "etag"));
        assertStatus(400, () -> uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId()));
        verify(remote, org.mockito.Mockito.never()).copy(anyString(), anyString(), anyString());
    }
    @Test
    void approvalDoesNotPublishImagesRemovedFromFinalContent() {
        var signed = presign();
        upload(signed, PNG);
        uploads.complete(SUBMISSION, OWNER_TOKEN, signed.uploadId());
        var unused = presign();
        upload(unused, PNG);
        var unusedResult = uploads.complete(SUBMISSION, OWNER_TOKEN, unused.uploadId());
        uploads.publish(SUBMISSION, List.of(signed.uploadId()));
        assertThat(uploads.media(signed.uploadId(), null).published()).isTrue();
        assertStatus(404, () -> uploads.media(unused.uploadId(), null));
        assertStatus(404, () -> uploads.publicUrl(unused.uploadId()));
        assertThat(uploads.media(unused.uploadId(), capability(unusedResult.url())).bytes()).isEqualTo(PNG);
    }
    private UploadService.PresignRequest request() {
        return new UploadService.PresignRequest("../../original.png", "image/png", PNG.length);
    }

    private UploadService.PresignResponse presign() { return uploads.presign(SUBMISSION, OWNER_TOKEN, request()); }

    private void upload(UploadService.PresignResponse signed, byte[] bytes) {
        uploads.uploadLocal(signed.uploadId(), capability(signed.uploadUrl()), "image/png", bytes.length,
                new ByteArrayInputStream(bytes));
    }

    private String capability(String url) { return url.substring(url.indexOf("?token=") + 7); }

    private void assertStatus(int expected, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode().value()).isEqualTo(expected));
    }
}


