package kr.co.buchu.storage;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StorageController {
    private final UploadService uploads;

    public StorageController(UploadService uploads) { this.uploads = uploads; }

    @PostMapping("/api/submissions/{id}/uploads/presign")
    public ResponseEntity<UploadService.PresignResponse> presign(@PathVariable String id,
            @RequestHeader(name = "X-Submission-Token", required = false) String token,
            @Valid @RequestBody UploadService.PresignRequest request) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(uploads.presign(id, token, request));
    }

    @PostMapping("/api/submissions/{id}/uploads/{uploadId}/complete")
    public ResponseEntity<UploadService.CompleteResponse> complete(@PathVariable String id, @PathVariable String uploadId,
            @RequestHeader(name = "X-Submission-Token", required = false) String token) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(uploads.complete(id, token, uploadId));
    }

    @PutMapping("/api/uploads/local/{uploadId}")
    public ResponseEntity<Void> localUpload(@PathVariable String uploadId,
            @RequestParam(required = false) String token, HttpServletRequest request) throws IOException {
        uploads.uploadLocal(uploadId, token, request.getContentType(), request.getContentLengthLong(), request.getInputStream());
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "private, no-store").build();
    }

    @GetMapping("/api/media/{uploadId}")
    public ResponseEntity<byte[]> media(@PathVariable String uploadId, @RequestParam(required = false) String token) {
        UploadService.MediaResponse media = uploads.media(uploadId, token);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(media.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, media.published() ? "public, max-age=86400, immutable" : "private, no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header("X-Content-Type-Options", "nosniff")
                .body(media.bytes());
    }
}
