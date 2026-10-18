CREATE TABLE members (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(20) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    nickname VARCHAR(12) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT members_username_unique UNIQUE (username),
    CONSTRAINT members_nickname_unique UNIQUE (nickname)
);

ALTER TABLE community_posts ADD COLUMN author_id VARCHAR(36);
ALTER TABLE community_posts ADD COLUMN author_type VARCHAR(10) NOT NULL DEFAULT 'ANON';
ALTER TABLE community_posts ADD COLUMN ip_hint VARCHAR(16);
ALTER TABLE community_comments ADD COLUMN author_id VARCHAR(36);
ALTER TABLE community_comments ADD COLUMN author_type VARCHAR(10) NOT NULL DEFAULT 'ANON';
ALTER TABLE community_comments ADD COLUMN ip_hint VARCHAR(16);

CREATE INDEX idx_community_posts_author ON community_posts (author_id);
CREATE INDEX idx_community_comments_author ON community_comments (author_id);
