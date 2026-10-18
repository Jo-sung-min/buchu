ALTER TABLE community_posts DROP CONSTRAINT community_post_category;
ALTER TABLE community_posts ADD CONSTRAINT community_post_category
    CHECK (category IN ('FREE', 'QUESTION', 'TIP', 'INCOME', 'STOCK', 'REALTY', 'WORK', 'LOVE', 'HEALTH', 'STORY'));
