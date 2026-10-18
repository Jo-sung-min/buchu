package kr.co.buchu.community;

import kr.co.buchu.submission.SubmissionAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Anonymous community posts and comments. Authors keep a one-time delete token; nothing identifying is stored. */
@Service
public class CommunityPostService {
    public static final Set<String> CATEGORIES = Set.of("FREE", "QUESTION", "TIP", "INCOME");
    private static final String POST_COLUMNS = "id, category, title, content, nickname, view_count, comment_count, created_at";
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    private final RowMapper<Post> postMapper = (rs, index) -> new Post(rs.getString("id"), rs.getString("category"), rs.getString("title"),
            rs.getString("content"), rs.getString("nickname"), rs.getInt("view_count"), rs.getInt("comment_count"), rs.getTimestamp("created_at").toInstant().toString());
    private final RowMapper<Comment> commentMapper = (rs, index) -> new Comment(rs.getString("id"), rs.getString("post_id"), rs.getString("content"),
            rs.getString("nickname"), rs.getTimestamp("created_at").toInstant().toString());

    public CommunityPostService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public CreatedPost create(PostInput input) {
        if (input == null || input.category() == null || !CATEGORIES.contains(input.category())) throw invalid("글 주제를 선택해 주세요.");
        String title = text(input.title(), 2, 100, "제목");
        String content = text(input.content(), 5, 5000, "내용");
        String token = token();
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String nickname = nickname();
        jdbc.update("INSERT INTO community_posts (id, category, title, content, nickname, delete_token_hash, view_count, comment_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)",
                id, input.category(), title, content, nickname, SubmissionAccessService.hash(token), now);
        return new CreatedPost(new Post(id, input.category(), title, content, nickname, 0, 0, now.toInstant().toString()), token);
    }

    @Transactional(readOnly = true)
    public PostPage list(String category, String sort, String query, int page, int size) {
        if (!Set.of("latest", "popular", "comments").contains(sort)) throw invalid("지원하지 않는 정렬 방식입니다.");
        if (page < 0 || page > 100_000 || size < 1 || size > 100) throw invalid("페이지 크기는 1~100 사이로 입력해 주세요.");
        String selectedCategory = category == null ? "" : category.trim();
        if (!selectedCategory.isBlank() && !CATEGORIES.contains(selectedCategory)) throw invalid("글 주제를 확인해 주세요.");
        String needle = query == null ? "" : query.strip();
        if (needle.length() > 120) throw invalid("검색어는 120자 이하로 입력해 주세요.");
        List<Object> args = new ArrayList<>();
        List<String> where = new ArrayList<>();
        if (!selectedCategory.isBlank()) { where.add("category = ?"); args.add(selectedCategory); }
        if (!needle.isBlank()) {
            String pattern = "%" + needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").toLowerCase() + "%";
            where.add("(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(content) LIKE ? ESCAPE '\\')");
            args.add(pattern); args.add(pattern);
        }
        String filter = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM community_posts" + filter, Long.class, args.toArray());
        String order = switch (sort) {
            case "popular" -> "(comment_count * 3 + view_count) DESC, created_at DESC, id DESC";
            case "comments" -> "comment_count DESC, created_at DESC, id DESC";
            default -> "created_at DESC, id DESC";
        };
        args.add(size); args.add(page * size);
        List<Post> items = jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts" + filter + " ORDER BY " + order + " LIMIT ? OFFSET ?", postMapper, args.toArray());
        return new PostPage(items, total, page, size);
    }

    @Transactional
    public Post read(String id) {
        if (jdbc.update("UPDATE community_posts SET view_count = view_count + 1 WHERE id = ?", id) == 0) throw notFound();
        return jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts WHERE id = ?", postMapper, id).getFirst();
    }

    @Transactional
    public void deleteOwned(String id, String token) {
        requireToken("community_posts", id, token);
        jdbc.update("DELETE FROM community_posts WHERE id = ?", id);
    }

    @Transactional
    public void deleteAdmin(String id) {
        if (jdbc.update("DELETE FROM community_posts WHERE id = ?", id) == 0) throw notFound();
    }

    @Transactional
    public CreatedComment comment(String postId, CommentInput input) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_posts WHERE id = ?", Integer.class, postId) == 0) throw notFound();
        String content = text(input == null ? null : input.content(), 1, 1000, "댓글");
        String token = token();
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String nickname = nickname();
        jdbc.update("INSERT INTO community_comments (id, post_id, content, nickname, delete_token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                id, postId, content, nickname, SubmissionAccessService.hash(token), now);
        jdbc.update("UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?", postId);
        return new CreatedComment(new Comment(id, postId, content, nickname, now.toInstant().toString()), token);
    }

    @Transactional(readOnly = true)
    public List<Comment> comments(String postId) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_posts WHERE id = ?", Integer.class, postId) == 0) throw notFound();
        return jdbc.query("SELECT id, post_id, content, nickname, created_at FROM community_comments WHERE post_id = ? ORDER BY created_at, id LIMIT 500", commentMapper, postId);
    }

    @Transactional
    public void deleteOwnedComment(String id, String token) {
        requireToken("community_comments", id, token);
        removeComment(id);
    }

    @Transactional
    public void deleteAdminComment(String id) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_comments WHERE id = ?", Integer.class, id) == 0) throw notFound();
        removeComment(id);
    }

    private void removeComment(String id) {
        List<String> posts = jdbc.query("SELECT post_id FROM community_comments WHERE id = ?", (rs, index) -> rs.getString(1), id);
        if (posts.isEmpty()) throw notFound();
        jdbc.update("DELETE FROM community_comments WHERE id = ?", id);
        jdbc.update("UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?", posts.getFirst());
    }

    private void requireToken(String table, String id, String token) {
        if (token == null || token.length() < 32 || token.length() > 128) throw notFound();
        List<String> matches = jdbc.query("SELECT delete_token_hash FROM " + table + " WHERE id = ? FOR UPDATE", (rs, index) -> rs.getString(1), id);
        if (matches.isEmpty() || !MessageDigest.isEqual(matches.getFirst().getBytes(StandardCharsets.US_ASCII),
                SubmissionAccessService.hash(token).getBytes(StandardCharsets.US_ASCII))) throw notFound();
    }

    private String token() {
        byte[] secret = new byte[32]; random.nextBytes(secret);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
    }

    private String nickname() {
        byte[] suffix = new byte[3]; random.nextBytes(suffix);
        return "익명" + HexFormat.of().formatHex(suffix);
    }

    private static String text(String raw, int min, int max, String field) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() < min || value.length() > max) throw invalid(field + "은 " + min + "~" + max + "자로 작성해 주세요.");
        if (value.codePoints().anyMatch(code -> Character.isISOControl(code) && code != '\n' && code != '\r' && code != '\t')) {
            throw invalid(field + "에 허용되지 않는 문자가 포함되어 있습니다.");
        }
        return value;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "글을 찾을 수 없거나 삭제 코드가 올바르지 않습니다."); }

    public record PostInput(String category, String title, String content) {}
    public record CommentInput(String content) {}
    public record Post(String id, String category, String title, String content, String nickname, int viewCount, int commentCount, String createdAt) {}
    public record Comment(String id, String postId, String content, String nickname, String createdAt) {}
    public record CreatedPost(Post post, String deleteToken) {}
    public record CreatedComment(Comment comment, String deleteToken) {}
    public record PostPage(List<Post> items, long total, int page, int size) {}
}
