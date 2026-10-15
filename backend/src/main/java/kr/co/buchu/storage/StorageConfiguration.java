package kr.co.buchu.storage;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StorageConfiguration {
    @Bean(destroyMethod = "close")
    ObjectStorage objectStorage(StorageProperties properties) {
        return switch (properties.provider()) {
            case "local" -> new LocalObjectStorage(properties.localDirectory());
            case "s3" -> new S3ObjectStorage(properties);
            default -> throw new IllegalArgumentException("STORAGE_PROVIDER must be local or s3");
        };
    }
}
