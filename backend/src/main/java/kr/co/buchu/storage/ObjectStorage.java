package kr.co.buchu.storage;

import java.io.InputStream;
import java.time.Duration;
import java.util.Map;

interface ObjectStorage extends AutoCloseable {
    boolean remote();
    PresignedTarget presign(String key, String contentType, long size, Duration lifetime);
    void putLocal(String key, String contentType, long size, InputStream input);
    VerifiedObject inspect(String key);
    void copy(String sourceKey, String targetKey, String sourceEtag);
    void delete(String key);
    byte[] read(String key, long expectedSize);

    @Override
    default void close() {}

    record PresignedTarget(String url, Map<String, String> headers) {}
    record VerifiedObject(long size, String contentType, byte[] signature, String etag) {}
}
