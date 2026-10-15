ALTER TABLE submissions ADD COLUMN board VARCHAR(16) NOT NULL DEFAULT 'MARKETER';
ALTER TABLE submissions ADD CONSTRAINT submission_board CHECK (board IN ('MARKETER', 'HELP'));
CREATE INDEX idx_submissions_board_status ON submissions (board, status, reviewed_at);

CREATE TABLE anonymous_reviews (
    id VARCHAR(36) PRIMARY KEY,
    program_slug VARCHAR(100) NOT NULL,
    rating SMALLINT NOT NULL,
    title VARCHAR(80) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    delete_token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT anonymous_review_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_anonymous_reviews_program_created ON anonymous_reviews (program_slug, created_at, id);
CREATE INDEX idx_anonymous_reviews_created ON anonymous_reviews (created_at, id);
