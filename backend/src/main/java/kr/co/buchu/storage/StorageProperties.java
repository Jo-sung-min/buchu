package kr.co.buchu.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public record StorageProperties(
        @Value("${STORAGE_PROVIDER:local}") String provider,
        @Value("${STORAGE_LOCAL_DIR:./uploads}") String localDirectory,
        @Value("${STORAGE_BUCKET:}") String bucket,
        @Value("${STORAGE_REGION:ap-northeast-2}") String region,
        @Value("${STORAGE_ENDPOINT:}") String endpoint,
        @Value("${STORAGE_PATH_STYLE:false}") boolean pathStyle,
        @Value("${CDN_BASE_URL:}") String cdnBaseUrl) {
}
