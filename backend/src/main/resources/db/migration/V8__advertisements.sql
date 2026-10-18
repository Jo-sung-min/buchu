CREATE TABLE advertisements (
    id VARCHAR(36) PRIMARY KEY,
    site_name VARCHAR(40) NOT NULL,
    tagline VARCHAR(60) NOT NULL,
    url VARCHAR(2000) NOT NULL,
    contact_email VARCHAR(254) NOT NULL,
    color VARCHAR(7) NOT NULL,
    status VARCHAR(16) NOT NULL,
    note VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT advertisement_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ENDED'))
);

CREATE INDEX idx_advertisements_status_created ON advertisements (status, created_at, id);
