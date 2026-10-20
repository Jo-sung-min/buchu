-- 글에 붙은 사진 목록. 홈 피드가 글을 한 문장으로 읽을 수 있도록 community_posts 안에 JSON 배열로 둔다
-- (최대 5장, [{"id": 업로드 id, "key": 저장 키}]). 글이 지워지면 목록도 같이 사라진다.
ALTER TABLE community_posts ADD COLUMN images VARCHAR(2000) NOT NULL DEFAULT '[]';
