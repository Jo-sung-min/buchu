CREATE TABLE upload_assets (
    id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    expected_size BIGINT NOT NULL,
    staging_key VARCHAR(512) NOT NULL,
    object_key VARCHAR(512),
    upload_token_hash VARCHAR(64) NOT NULL,
    read_token VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    published BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT upload_size_range CHECK (expected_size > 0 AND expected_size <= 8388608),
    CONSTRAINT upload_status CHECK (status IN ('PENDING', 'COMPLETED'))
);

CREATE INDEX idx_upload_assets_submission ON upload_assets (submission_id);
