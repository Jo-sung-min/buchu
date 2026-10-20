package kr.co.buchu.storage;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.co.buchu.submission.SubmissionAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UploadService {
    private static final Duration UPLOAD_LIFETIME = Duration.ofMinutes(10);
    /** Photos one community post may carry. */
    public static final int COMMUNITY_IMAGE_LIMIT = 5;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final JdbcTemplate jdbc;
    private final SubmissionAccessService access;
    private final ObjectStorage storage;
    private final StorageProperties properties;

    public UploadService(JdbcTemplate jdbc, SubmissionAccessService access,
                         ObjectStorage storage, StorageProperties properties) {
        this.jdbc = jdbc;
        this.access = access;
        this.storage = storage;
        this.properties = properties;
    }

    @Transactional
    public PresignResponse presign(String submissionId, String ownerToken, PresignRequest request) {
        access.requireEditable(submissionId, ownerToken);
        validate(request);
        Instant now = Instant.now();
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM upload_assets WHERE submission_id = ? "
                + "AND (status = 'COMPLETED' OR expires_at > ?)", Integer.class, submissionId, Timestamp.from(now));
        if (count != null && count >= 20) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "신청서당 이미지는 최대 20개까지 등록할 수 있습니다.");
        }
        String uploadId = UUID.randomUUID().toString();
        String capability = token();
        String key = "staging/" + submissionId + "/" + uploadId + "." + ImageFiles.EXTENSIONS.get(request.contentType());
        ObjectStorage.PresignedTarget target = storage.remote()
                ? storage.presign(key, request.contentType(), request.size(), UPLOAD_LIFETIME)
                : new ObjectStorage.PresignedTarget("/api/uploads/local/" + uploadId + "?token=" + capability,
                        Map.of("Content-Type", request.contentType()));
        jdbc.update("INSERT INTO upload_assets (id, submission_id, file_name, content_type, expected_size, "
                        + "staging_key, upload_token_hash, read_token, status, published, expires_at, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', FALSE, ?, ?)",
                uploadId, submissionId, request.fileName(), request.contentType(), request.size(), key,
                hash(capability), token(), Timestamp.from(now.plus(UPLOAD_LIFETIME)), Timestamp.from(now));
        return new PresignResponse(uploadId, key, target.url(), "PUT", target.headers(), UPLOAD_LIFETIME.toSeconds());
    }

    /**
     * Same presigned contract for a community post photo. There is no draft to own the upload, so the caller keeps
     * a per-upload secret instead: it completes the upload and attaches it to a post with that secret.
     */
    @Transactional
    public CommunityPresignResponse presignCommunity(PresignRequest request) {
        validate(request);
        Instant now = Instant.now();
        String uploadId = UUID.randomUUID().toString();
        String capability = token();
        String key = "staging/community/" + uploadId + "." + ImageFiles.EXTENSIONS.get(request.contentType());
        ObjectStorage.PresignedTarget target = storage.remote()
                ? storage.presign(key, request.contentType(), request.size(), UPLOAD_LIFETIME)
                : new ObjectStorage.PresignedTarget("/api/uploads/local/" + uploadId + "?token=" + capability,
                        Map.of("Content-Type", request.contentType()));
        jdbc.update("INSERT INTO upload_assets (id, scope, submission_id, file_name, content_type, expected_size, "
                        + "staging_key, upload_token_hash, read_token, status, published, expires_at, created_at) "
                        + "VALUES (?, 'COMMUNITY', NULL, ?, ?, ?, ?, ?, ?, 'PENDING', FALSE, ?, ?)",
                uploadId, request.fileName(), request.contentType(), request.size(), key,
                hash(capability), token(), Timestamp.from(now.plus(UPLOAD_LIFETIME)), Timestamp.from(now));
        return new CommunityPresignResponse(uploadId, key, target.url(), "PUT", target.headers(), UPLOAD_LIFETIME.toSeconds(), capability);
    }

    private static void validate(PresignRequest request) {
        if (request == null || request.fileName() == null || request.fileName().isBlank()
                || request.fileName().length() > 255 || request.contentType() == null
                || !ImageFiles.EXTENSIONS.containsKey(request.contentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JPG, PNG, WebP, GIF 이미지 파일만 등록할 수 있습니다.");
        }
        if (request.size() <= 0 || request.size() > ImageFiles.MAX_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지는 최대 8MB까지 업로드할 수 있습니다.");
        }
    }

    @Transactional
    public void uploadLocal(String uploadId, String capability, String contentType, long contentLength, InputStream input) {
        if (storage.remote()) throw notFound();
        Asset initial = find(uploadId, false);
        if (!matches(hash(capability == null ? "" : capability), initial.uploadTokenHash())) throw notFound();
        if (!initial.community()) {
            // Use the same lock order as save/submit/review so an in-flight PUT cannot race submission review.
            List<String> states = jdbc.queryForList("SELECT status FROM submissions WHERE id = ? FOR UPDATE", String.class,
                    initial.submissionId());
            if (states.isEmpty()) throw notFound();
            if (!List.of("DRAFT", "REJECTED").contains(states.getFirst())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "심사 중이거나 승인된 신청서에는 이미지를 등록할 수 없습니다.");
            }
        }
        Asset asset = find(uploadId, true);
        requirePending(asset);
        if (!asset.contentType().equals(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일의 Content-Type이 등록 요청과 다릅니다.");
        }
        if (contentLength > ImageFiles.MAX_SIZE || contentLength > asset.size()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "이미지는 최대 8MB이며 신청한 파일 크기와 일치해야 합니다.");
        }
        if (contentLength >= 0 && contentLength != asset.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드한 파일 크기가 신청한 크기와 다릅니다.");
        }
        storage.putLocal(asset.stagingKey(), asset.contentType(), asset.size(), input);
    }

    @Transactional
    public CompleteResponse complete(String submissionId, String ownerToken, String uploadId) {
        access.requireEditable(submissionId, ownerToken);
        Asset asset = find(uploadId, true);
        if (asset.community() || !submissionId.equals(asset.submissionId())) throw notFound();
        return finish(asset, "private/" + submissionId + "/");
    }

    /** Verifies a community photo the browser has finished putting; the upload secret from presign stands in for the owner token. */
    @Transactional
    public CompleteResponse completeCommunity(String uploadId, String uploadToken) {
        Asset asset = owned(uploadId, uploadToken);
        return finish(asset, "private/community/");
    }

    private CompleteResponse finish(Asset asset, String immutablePrefix) {
        if (asset.completed()) return response(asset);
        requirePending(asset);
        ObjectStorage.VerifiedObject object = storage.inspect(asset.stagingKey());
        if (object.size() != asset.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드한 파일 크기가 신청한 크기와 다릅니다.");
        }
        if (object.contentType() != null && !asset.contentType().equals(object.contentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드한 파일의 형식이 등록 요청과 다릅니다.");
        }
        ImageFiles.validateSignature(asset.contentType(), object.signature());
        // The presigned PUT can only overwrite staging. The verified copy is a new immutable object.
        String immutableKey = immutablePrefix + UUID.randomUUID() + "." + ImageFiles.EXTENSIONS.get(asset.contentType());
        storage.copy(asset.stagingKey(), immutableKey, object.etag());
        jdbc.update("UPDATE upload_assets SET object_key = ?, status = 'COMPLETED' WHERE id = ?", immutableKey, asset.id());
        deleteAfterCommit(asset.stagingKey());
        return response(find(asset.id(), false));
    }

    /**
     * Makes completed community photos public and binds each to one post. A photo can be attached only once: the
     * row is flipped to published under lock, so the same upload cannot be reused by another post later.
     */
    @Transactional
    public List<AttachedImage> attachCommunity(List<ImageReference> references, String postId) {
        if (references == null || references.isEmpty()) return List.of();
        if (references.size() > COMMUNITY_IMAGE_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사진은 글 하나에 최대 " + COMMUNITY_IMAGE_LIMIT + "장까지 붙일 수 있습니다.");
        }
        if (references.stream().map(ImageReference::uploadId).distinct().count() != references.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "같은 사진이 두 번 들어 있습니다.");
        }
        List<AttachedImage> attached = new java.util.ArrayList<>();
        for (ImageReference reference : references) {
            Asset asset = owned(reference == null ? null : reference.uploadId(), reference == null ? null : reference.token());
            if (!asset.completed() || asset.published()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드가 끝난 사진만 글에 붙일 수 있습니다. 사진을 다시 올려 주세요.");
            }
            String publicKey = asset.objectKey();
            if (storage.remote()) {
                publicKey = "published/community/" + postId + "/" + UUID.randomUUID() + "." + ImageFiles.EXTENSIONS.get(asset.contentType());
                ObjectStorage.VerifiedObject object = storage.inspect(asset.objectKey());
                storage.copy(asset.objectKey(), publicKey, object.etag());
                deleteAfterCommit(asset.objectKey());
            }
            jdbc.update("UPDATE upload_assets SET published = TRUE, object_key = ? WHERE id = ?", publicKey, asset.id());
            attached.add(new AttachedImage(asset.id(), publicKey));
        }
        return attached;
    }

    /** The uploader changed their mind before posting: drop a photo that is not attached to any post yet. */
    @Transactional
    public void discardCommunityOwned(String uploadId, String uploadToken) {
        Asset asset = owned(uploadId, uploadToken);
        if (asset.published()) throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 글에 붙은 사진은 글과 함께 지워집니다.");
        discardCommunity(List.of(asset.id()));
    }

    /** Removes the photos of a deleted post: the rows now, the stored files once the deletion is committed. */
    @Transactional
    public void discardCommunity(Collection<String> uploadIds) {
        for (String id : uploadIds) {
            List<Asset> matches = jdbc.query("SELECT * FROM upload_assets WHERE id = ? AND scope = 'COMMUNITY'", this::map, id);
            if (matches.isEmpty()) continue;
            Asset asset = matches.getFirst();
            jdbc.update("DELETE FROM upload_assets WHERE id = ?", id);
            deleteAfterCommit(asset.stagingKey());
            if (asset.objectKey() != null) deleteAfterCommit(asset.objectKey());
        }
    }

    /** The address a post stores for one of its photos resolves to, without touching the database. */
    public String publicUrl(String uploadId, String objectKey) {
        String base = properties.cdnBaseUrl().replaceAll("/+$", "");
        return storage.remote() && !base.isBlank() ? base + "/" + objectKey : "/api/media/" + uploadId;
    }

    private Asset owned(String uploadId, String uploadToken) {
        if (uploadId == null || uploadId.isBlank() || uploadToken == null || uploadToken.length() < 32 || uploadToken.length() > 128) throw notFound();
        Asset asset = find(uploadId, true);
        if (!asset.community() || !matches(hash(uploadToken), asset.uploadTokenHash())) throw notFound();
        return asset;
    }

    public void validateReady(String submissionId, Collection<String> ids) {
        if (ids == null || ids.isEmpty()) return;
        if (ids.size() > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신청서당 이미지는 최대 20개까지 등록할 수 있습니다.");
        }
        for (String id : ids) {
            Asset asset = find(id, false);
            if (asset.community() || !submissionId.equals(asset.submissionId()) || !asset.completed()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 신청서에서 업로드 완료된 이미지만 사용할 수 있습니다.");
            }
        }
    }

    public String previewUrl(String uploadId) {
        Asset asset = completed(uploadId);
        return "/api/media/" + asset.id() + "?token=" + asset.readToken();
    }

    public String publicUrl(String uploadId) {
        Asset asset = completed(uploadId);
        if (!asset.published()) throw notFound();
        String base = properties.cdnBaseUrl().replaceAll("/+$", "");
        return storage.remote() && !base.isBlank() ? base + "/" + asset.objectKey() : "/api/media/" + asset.id();
    }

    @Transactional
    public void publish(String submissionId, Collection<String> referencedIds) {
        validateReady(submissionId, referencedIds);
        java.util.Set<String> approvedIds = referencedIds == null ? java.util.Set.of() : java.util.Set.copyOf(referencedIds);
        List<Asset> assets = jdbc.query("SELECT * FROM upload_assets WHERE submission_id = ? "
                + "AND status = 'COMPLETED' AND published = FALSE FOR UPDATE", this::map, submissionId);
        for (Asset asset : assets) {
            if (!approvedIds.contains(asset.id())) continue;
            String publicKey = asset.objectKey();
            if (storage.remote()) {
                publicKey = "published/" + submissionId + "/" + UUID.randomUUID() + "."
                        + ImageFiles.EXTENSIONS.get(asset.contentType());
                ObjectStorage.VerifiedObject object = storage.inspect(asset.objectKey());
                storage.copy(asset.objectKey(), publicKey, object.etag());
                deleteAfterCommit(asset.objectKey());
            }
            jdbc.update("UPDATE upload_assets SET published = TRUE, object_key = ? WHERE id = ?", publicKey, asset.id());
        }
    }

    public MediaResponse media(String uploadId, String capability) {
        Asset asset = completed(uploadId);
        if (!asset.published() && !matches(asset.readToken(), capability == null ? "" : capability)) throw notFound();
        return new MediaResponse(storage.read(asset.objectKey(), asset.size()), asset.contentType(), asset.published());
    }

    private CompleteResponse response(Asset asset) {
        return new CompleteResponse(asset.id(), asset.objectKey(), previewUrl(asset.id()), asset.contentType(), asset.size());
    }

    private Asset completed(String id) {
        Asset asset = find(id, false);
        if (!asset.completed()) throw notFound();
        return asset;
    }

    private Asset find(String id, boolean lock) {
        List<Asset> matches = jdbc.query("SELECT * FROM upload_assets WHERE id = ?" + (lock ? " FOR UPDATE" : ""), this::map, id);
        if (matches.isEmpty()) throw notFound();
        return matches.getFirst();
    }

    private Asset map(ResultSet rs, int index) throws SQLException {
        return new Asset(rs.getString("id"), rs.getString("scope"), rs.getString("submission_id"), rs.getString("content_type"),
                rs.getLong("expected_size"), rs.getString("staging_key"), rs.getString("object_key"),
                rs.getString("upload_token_hash"), rs.getString("read_token"), rs.getString("status"),
                rs.getBoolean("published"), rs.getTimestamp("expires_at").toInstant());
    }

    private void requirePending(Asset asset) {
        if (asset.completed()) throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 완료된 이미지는 변경할 수 없습니다.");
        if (asset.expiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.GONE, "업로드 링크가 만료되었습니다. 이미지를 다시 선택해 주세요.");
        }
    }

    private void deleteAfterCommit(String key) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { storage.delete(key); }
            });
        } else {
            storage.delete(key);
        }
    }

    private static String token() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private static boolean matches(String expected, String actual) {
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.");
    }

    public record PresignRequest(@NotBlank @Size(max = 255) String fileName,
                                 @NotBlank @Size(max = 64) String contentType,
                                 @Min(1) @Max(ImageFiles.MAX_SIZE) long size) {}
    public record PresignResponse(String uploadId, String objectKey, String uploadUrl, String method,
                                  Map<String, String> headers, long expiresInSeconds) {}
    /** Like {@link PresignResponse}, plus the secret the browser later presents to complete and attach the photo. */
    public record CommunityPresignResponse(String uploadId, String objectKey, String uploadUrl, String method,
                                           Map<String, String> headers, long expiresInSeconds, String uploadToken) {}
    public record CompleteResponse(String uploadId, String objectKey, String url, String contentType, long size) {}
    public record MediaResponse(byte[] bytes, String contentType, boolean published) {}
    public record ImageReference(String uploadId, String token) {}
    public record AttachedImage(String id, String key) {}
    private record Asset(String id, String scope, String submissionId, String contentType, long size, String stagingKey,
                         String objectKey, String uploadTokenHash, String readToken, String status,
                         boolean published, Instant expiresAt) {
        boolean completed() { return "COMPLETED".equals(status); }
        boolean community() { return "COMMUNITY".equals(scope); }
    }
}

