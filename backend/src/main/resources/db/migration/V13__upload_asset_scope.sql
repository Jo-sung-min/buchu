-- 커뮤니티 글 사진도 기업 신청과 같은 프리사인 계약(upload_assets)으로 올린다. 신청서가 아닌 글에
-- 속하는 업로드를 구분하기 위해 scope를 두고, 그 경우 submission_id는 비운다.
ALTER TABLE upload_assets ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT 'SUBMISSION';
ALTER TABLE upload_assets ALTER COLUMN submission_id DROP NOT NULL;
ALTER TABLE upload_assets ADD CONSTRAINT upload_scope CHECK (scope IN ('SUBMISSION', 'COMMUNITY'));
