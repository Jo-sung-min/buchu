CREATE TABLE community_posts (
    id VARCHAR(36) PRIMARY KEY,
    category VARCHAR(16) NOT NULL,
    title VARCHAR(100) NOT NULL,
    content VARCHAR(5000) NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    delete_token_hash VARCHAR(64) NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT community_post_category CHECK (category IN ('FREE', 'QUESTION', 'TIP', 'INCOME'))
);

CREATE INDEX idx_community_posts_created ON community_posts (created_at, id);
CREATE INDEX idx_community_posts_category_created ON community_posts (category, created_at, id);

CREATE TABLE community_comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
    content VARCHAR(1000) NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    delete_token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_community_comments_post_created ON community_comments (post_id, created_at, id);
