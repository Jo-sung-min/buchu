package kr.co.buchu.storage;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

final class S3ObjectStorage implements ObjectStorage {
    private final String bucket;
    private final S3Client client;
    private final S3Presigner presigner;

    S3ObjectStorage(StorageProperties properties) {
        if (properties.bucket().isBlank()) {
            throw new IllegalArgumentException("STORAGE_BUCKET must be configured when STORAGE_PROVIDER=s3");
        }
        bucket = properties.bucket();
        var configuration = S3Configuration.builder()
                .pathStyleAccessEnabled(properties.pathStyle()).checksumValidationEnabled(false).build();
        var clientBuilder = S3Client.builder().region(Region.of(properties.region()))
                .serviceConfiguration(configuration)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED);
        var signerBuilder = S3Presigner.builder().region(Region.of(properties.region()))
                .serviceConfiguration(configuration);
        if (!properties.endpoint().isBlank()) {
            URI endpoint = URI.create(properties.endpoint());
            if (!java.util.Set.of("http", "https").contains(endpoint.getScheme()) || endpoint.getHost() == null) {
                throw new IllegalArgumentException("STORAGE_ENDPOINT must be an HTTP(S) URL");
            }
            clientBuilder.endpointOverride(endpoint);
            signerBuilder.endpointOverride(endpoint);
        }
        client = clientBuilder.build();
        presigner = signerBuilder.build();
    }

    @Override
    public boolean remote() { return true; }

    @Override
    public PresignedTarget presign(String key, String contentType, long size, Duration lifetime) {
        try {
            var request = presigner.presignPutObject(PutObjectPresignRequest.builder()
                    .signatureDuration(lifetime)
                    .putObjectRequest(builder -> builder.bucket(bucket).key(key)
                            .contentType(contentType).contentLength(size)).build());
            Map<String, String> headers = new LinkedHashMap<>();
            request.signedHeaders().forEach((name, values) -> {
                // Browser sets Host and Content-Length; all other signed headers must be sent verbatim.
                if (!java.util.Set.of("host", "content-length").contains(name.toLowerCase(Locale.ROOT))) {
                    headers.put(name, String.join(",", values));
                }
            });
            headers.putIfAbsent("content-type", contentType);
            return new PresignedTarget(request.url().toString(), headers);
        } catch (software.amazon.awssdk.core.exception.SdkException error) {
            throw unavailable();
        }
    }

    @Override
    public void putLocal(String key, String type, long size, InputStream input) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "업로드 경로를 찾을 수 없습니다.");
    }

    @Override
    public VerifiedObject inspect(String key) {
        try {
            var metadata = client.headObject(request -> request.bucket(bucket).key(key));
            if (metadata.contentLength() == null || metadata.contentLength() < 1
                    || metadata.contentLength() > ImageFiles.MAX_SIZE) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "이미지는 최대 8MB까지 업로드할 수 있습니다.");
            }
            var prefix = client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key)
                    .ifMatch(metadata.eTag()).range("bytes=0-31").build()).asByteArray();
            return new VerifiedObject(metadata.contentLength(), metadata.contentType(), prefix, metadata.eTag());
        } catch (S3Exception error) {
            if (error.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "먼저 이미지를 업로드해 주세요.");
            }
            if (error.statusCode() == 412) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "업로드 중 파일이 변경되었습니다. 다시 업로드해 주세요.");
            }
            throw unavailable();
        } catch (software.amazon.awssdk.core.exception.SdkException error) {
            throw unavailable();
        }
    }

    @Override
    public void copy(String sourceKey, String targetKey, String sourceEtag) {
        try {
            client.copyObject(CopyObjectRequest.builder().destinationBucket(bucket).destinationKey(targetKey)
                    .sourceBucket(bucket).sourceKey(sourceKey).copySourceIfMatch(sourceEtag).build());
        } catch (S3Exception error) {
            if (error.statusCode() == 412) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "업로드 중 파일이 변경되었습니다. 다시 업로드해 주세요.");
            }
            throw unavailable();
        } catch (software.amazon.awssdk.core.exception.SdkException error) {
            throw unavailable();
        }
    }

    @Override
    public void delete(String key) {
        try {
            client.deleteObject(request -> request.bucket(bucket).key(key));
        } catch (software.amazon.awssdk.core.exception.SdkException ignored) {
            // Staging lifecycle rules may remove leftovers; never invalidate a verified immutable copy.
        }
    }

    @Override
    public byte[] read(String key, long expectedSize) {
        try (var stream = client.getObject(request -> request.bucket(bucket).key(key))) {
            return ImageFiles.readLimited(stream, expectedSize);
        } catch (S3Exception error) {
            if (error.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.");
            }
            throw unavailable();
        } catch (IOException | software.amazon.awssdk.core.exception.SdkException error) {
            throw unavailable();
        }
    }

    @Override
    public void close() {
        presigner.close();
        client.close();
    }

    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "이미지 저장소에 연결하지 못했습니다. 저장소 설정을 확인해 주세요.");
    }
}

