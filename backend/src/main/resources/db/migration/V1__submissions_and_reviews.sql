CREATE TABLE submissions (
    id VARCHAR(36) PRIMARY KEY,
    access_token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    company_name VARCHAR(160) NOT NULL DEFAULT '',
    program_name VARCHAR(160) NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note VARCHAR(2000),
    published_slug VARCHAR(80) UNIQUE,
    CONSTRAINT submission_status CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_submissions_status_created ON submissions (status, created_at);

CREATE TABLE review_events (
    id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL REFERENCES submissions (id),
    decision VARCHAR(16) NOT NULL,
    note VARCHAR(2000) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reviewed_by VARCHAR(160) NOT NULL,
    CONSTRAINT review_decision CHECK (decision IN ('APPROVED', 'REJECTED'))
);

CREATE INDEX idx_review_events_submission ON review_events (submission_id, reviewed_at);
