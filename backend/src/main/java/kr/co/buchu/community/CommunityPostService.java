package kr.co.buchu.community;

import com.fasterxml.jackson.annotation.JsonIgnore;
import kr.co.buchu.member.MemberService;
import kr.co.buchu.security.ClientAddress;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Anonymous community posts and comments. Authors keep a one-time delete token; nothing identifying is stored. */
@Service
public class CommunityPostService {
    /** Display order of topics on the front page. */
    public static final List<String> CATEGORY_ORDER = List.of("FREE", "INCOME", "QUESTION", "TIP", "STOCK", "REALTY", "WORK", "LOVE", "HEALTH", "STORY");
    public static final Set<String> CATEGORIES = Set.copyOf(CATEGORY_ORDER);
    private static final String POST_COLUMNS = "id, category, title, content, nickname, view_count, comment_count, created_at, author_id, author_type, ip_hint";
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    private final RowMapper<Post> postMapper = (rs, index) -> new Post(rs.getString("id"), rs.getString("category"), rs.getString("title"),
            rs.getString("content"), rs.getString("nickname"), rs.getInt("view_count"), rs.getInt("comment_count"), rs.getTimestamp("created_at").toInstant().toString(),
            rs.getString("author_id"), rs.getString("author_type"), rs.getString("ip_hint"), false);
    private final RowMapper<Comment> commentMapper = (rs, index) -> new Comment(rs.getString("id"), rs.getString("post_id"), rs.getString("content"),
            rs.getString("nickname"), rs.getTimestamp("created_at").toInstant().toString(), rs.getString("author_id"), rs.getString("author_type"), rs.getString("ip_hint"), false);

    public CommunityPostService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public CreatedPost create(PostInput input, Author author) {
        if (input == null || input.category() == null || !CATEGORIES.contains(input.category())) throw invalid("글 주제를 선택해 주세요.");
        String title = text(input.title(), 2, 100, "제목");
        String content = text(input.content(), 5, 5000, "내용");
        // Members delete through their session; anonymous authors keep a one-time delete code like DC's post password.
        String token = author.member() ? null : token();
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO community_posts (id, category, title, content, nickname, delete_token_hash, view_count, comment_count, created_at, author_id, author_type, ip_hint) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)",
                id, input.category(), title, content, author.nickname(), SubmissionAccessService.hash(token == null ? UUID.randomUUID().toString() : token), now, author.id(), author.type(), author.ipHint());
        return new CreatedPost(new Post(id, input.category(), title, content, author.nickname(), 0, 0, now.toInstant().toString(), author.id(), author.type(), author.ipHint(), author.member()), token);
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
            case "popular" -> "(comment_count * 3 + view_count) DESC, created_at DESC, seq DESC";
            case "comments" -> "comment_count DESC, created_at DESC, seq DESC";
            default -> "created_at DESC, seq DESC";
        };
        args.add(size); args.add(page * size);
        List<Post> items = jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts" + filter + " ORDER BY " + order + " LIMIT ? OFFSET ?", postMapper, args.toArray());
        return new PostPage(items, total, page, size);
    }

    /** Everything the front page shows in one round trip: today's hot posts, the newest, and the newest per topic. */
    @Transactional(readOnly = true)
    public HomeFeed home() {
        List<Post> popular = jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts ORDER BY (comment_count * 3 + view_count) DESC, created_at DESC, seq DESC LIMIT 10", postMapper);
        List<Post> latest = jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts ORDER BY created_at DESC, seq DESC LIMIT 10", postMapper);
        Map<String, List<Post>> byCategory = new LinkedHashMap<>();
        for (String category : CATEGORY_ORDER) byCategory.put(category, new ArrayList<>());
        jdbc.query("SELECT " + POST_COLUMNS + " FROM (SELECT " + POST_COLUMNS + ", seq, ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC, seq DESC) AS rn FROM community_posts) ranked WHERE rn <= 5 ORDER BY category, created_at DESC, seq DESC", postMapper)
                .forEach(post -> byCategory.computeIfAbsent(post.category(), ignored -> new ArrayList<>()).add(post));
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM community_posts", Long.class);
        return new HomeFeed(popular, latest, byCategory, total);
    }

    @Transactional
    public Post read(String id) {
        if (jdbc.update("UPDATE community_posts SET view_count = view_count + 1 WHERE id = ?", id) == 0) throw notFound();
        return jdbc.query("SELECT " + POST_COLUMNS + " FROM community_posts WHERE id = ?", postMapper, id).getFirst();
    }

    @Transactional
    public void deleteOwned(String id, String token, String viewerId) {
        if (!ownedByMember("community_posts", id, viewerId)) requireToken("community_posts", id, token);
        jdbc.update("DELETE FROM community_posts WHERE id = ?", id);
    }

    @Transactional
    public void deleteAdmin(String id) {
        if (jdbc.update("DELETE FROM community_posts WHERE id = ?", id) == 0) throw notFound();
    }

    @Transactional
    public CreatedComment comment(String postId, CommentInput input, Author author) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_posts WHERE id = ?", Integer.class, postId) == 0) throw notFound();
        String content = text(input == null ? null : input.content(), 1, 1000, "댓글");
        String token = author.member() ? null : token();
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO community_comments (id, post_id, content, nickname, delete_token_hash, created_at, author_id, author_type, ip_hint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, postId, content, author.nickname(), SubmissionAccessService.hash(token == null ? UUID.randomUUID().toString() : token), now, author.id(), author.type(), author.ipHint());
        jdbc.update("UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?", postId);
        return new CreatedComment(new Comment(id, postId, content, author.nickname(), now.toInstant().toString(), author.id(), author.type(), author.ipHint(), author.member()), token);
    }

    @Transactional(readOnly = true)
    public List<Comment> comments(String postId) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_posts WHERE id = ?", Integer.class, postId) == 0) throw notFound();
        return jdbc.query("SELECT id, post_id, content, nickname, created_at, author_id, author_type, ip_hint FROM community_comments WHERE post_id = ? ORDER BY created_at, seq LIMIT 500", commentMapper, postId);
    }

    @Transactional
    public void deleteOwnedComment(String id, String token, String viewerId) {
        if (!ownedByMember("community_comments", id, viewerId)) requireToken("community_comments", id, token);
        removeComment(id);
    }

    private boolean ownedByMember(String table, String id, String viewerId) {
        if (viewerId == null || viewerId.isBlank()) return false;
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE id = ? AND author_type = 'MEMBER' AND author_id = ?", Integer.class, id, viewerId) > 0;
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

    /** Who is writing: a signed-in member under their nickname, or an anonymous visitor shown as "ㅇㅇ(ip)" like DC. */
    public static Author author(MemberService.Member member, String address) {
        return member != null ? new Author(member.id(), "MEMBER", member.nickname(), null)
                : new Author(null, "ANON", "ㅇㅇ", ClientAddress.hint(address));
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
    public record Author(String id, String type, String nickname, String ipHint) {
        public boolean member() { return "MEMBER".equals(type); }
    }
    public record Post(String id, String category, String title, String content, String nickname, int viewCount, int commentCount, String createdAt,
                       @JsonIgnore String authorId, String authorType, String ipHint, boolean mine) {
        public Post seenBy(String viewerId) { return viewerId != null && "MEMBER".equals(authorType) && viewerId.equals(authorId) ? new Post(id, category, title, content, nickname, viewCount, commentCount, createdAt, authorId, authorType, ipHint, true) : this; }
    }
    public record Comment(String id, String postId, String content, String nickname, String createdAt,
                          @JsonIgnore String authorId, String authorType, String ipHint, boolean mine) {
        public Comment seenBy(String viewerId) { return viewerId != null && "MEMBER".equals(authorType) && viewerId.equals(authorId) ? new Comment(id, postId, content, nickname, createdAt, authorId, authorType, ipHint, true) : this; }
    }
    public record CreatedPost(Post post, String deleteToken) {}
    public record CreatedComment(Comment comment, String deleteToken) {}
    public record PostPage(List<Post> items, long total, int page, int size) {}
    public record HomeFeed(List<Post> popular, List<Post> latest, Map<String, List<Post>> byCategory, long total) {}
}
