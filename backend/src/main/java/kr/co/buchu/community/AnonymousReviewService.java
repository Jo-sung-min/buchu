package kr.co.buchu.community;

import com.fasterxml.jackson.databind.JsonNode;
import kr.co.buchu.program.Program;
import kr.co.buchu.program.ProgramService;
import kr.co.buchu.submission.SubmissionAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AnonymousReviewService {
    private final JdbcTemplate jdbc;
    private final ProgramService programs;
    private final SecureRandom random = new SecureRandom();

    public AnonymousReviewService(JdbcTemplate jdbc, ProgramService programs) {
        this.jdbc = jdbc;
        this.programs = programs;
    }

    @Transactional
    public CreatedReview create(String programSlug, ReviewInput input) {
        Program program = requireMarketer(programSlug);
        if (input == null || input.rating() == null || !input.rating().isIntegralNumber()
                || !input.rating().canConvertToInt() || input.rating().intValue() < 1 || input.rating().intValue() > 5) {
            throw invalid("별점은 1~5 사이의 정수로 선택해 주세요.");
        }
        String title = text(input.title(), 3, 80, "평가 제목");
        String content = text(input.content(), 10, 2000, "평가 내용");
        byte[] secret = new byte[32]; random.nextBytes(secret);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        byte[] suffix = new byte[3]; random.nextBytes(suffix);
        String nickname = "익명" + HexFormat.of().formatHex(suffix);
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO anonymous_reviews (id, program_slug, rating, title, content, nickname, delete_token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id, program.slug(), input.rating().intValue(), title, content, nickname, SubmissionAccessService.hash(token), now);
        return new CreatedReview(new Review(id, program.slug(), program.name(), input.rating().intValue(), title, content, nickname, now.toInstant().toString()), token);
    }

    @Transactional(readOnly = true)
    public ReviewPage list(String programSlug, String sort, int page, int size, boolean admin) {
        if (!Set.of("latest", "rating_desc").contains(sort)) throw invalid("지원하지 않는 정렬 방식입니다.");
        if (page < 0 || page > 100_000 || size < 1 || size > 100) throw invalid("페이지 크기는 1~100 사이로 입력해 주세요.");
        String selectedSlug = programSlug == null ? "" : programSlug.trim();
        if (selectedSlug.length() > 100) throw invalid("프로그램 주소를 확인해 주세요.");
        Map<String, String> names = marketerNames();
        if (!selectedSlug.isBlank() && !admin && !names.containsKey(selectedSlug)) throw notFoundProgram();
        List<Object> args = new ArrayList<>();
        String where;
        if (!selectedSlug.isBlank()) {
            where = " WHERE program_slug = ?";
            args.add(selectedSlug);
        } else if (admin) {
            where = "";
        } else {
            if (names.isEmpty()) return new ReviewPage(List.of(), 0, page, size);
            where = " WHERE program_slug IN (" + String.join(",", names.keySet().stream().map(ignored -> "?").toList()) + ")";
            args.addAll(names.keySet());
        }
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM anonymous_reviews" + where, Long.class, args.toArray());
        args.add(size); args.add(page * size);
        String order = "rating_desc".equals(sort) ? "rating DESC, created_at DESC, id DESC" : "created_at DESC, id DESC";
        List<Review> items = jdbc.query("SELECT id, program_slug, rating, title, content, nickname, created_at FROM anonymous_reviews"
                        + where + " ORDER BY " + order + " LIMIT ? OFFSET ?",
                (rs, index) -> new Review(rs.getString("id"), rs.getString("program_slug"), names.getOrDefault(rs.getString("program_slug"), rs.getString("program_slug")),
                        rs.getInt("rating"), rs.getString("title"), rs.getString("content"), rs.getString("nickname"), rs.getTimestamp("created_at").toInstant().toString()),
                args.toArray());
        return new ReviewPage(items, total, page, size);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        Map<String, String> names = marketerNames();
        Map<String, Aggregate> grouped = new LinkedHashMap<>();
        jdbc.query("SELECT program_slug, COUNT(*) AS total, SUM(rating) AS rating_sum FROM anonymous_reviews GROUP BY program_slug",
                rs -> { grouped.put(rs.getString("program_slug"), new Aggregate(rs.getLong("total"), rs.getLong("rating_sum"))); });
        List<ProgramSummary> summaries = new ArrayList<>();
        long total = 0, sum = 0;
        for (String slug : names.keySet()) {
            Aggregate item = grouped.getOrDefault(slug, new Aggregate(0, 0));
            summaries.add(new ProgramSummary(slug, item.count(), average(item.sum(), item.count())));
            total += item.count(); sum += item.sum();
        }
        return new Summary(total, average(sum, total), summaries);
    }

    @Transactional
    public void deleteOwned(String id, String token) {
        if (token == null || token.length() < 32 || token.length() > 128) throw notFound();
        List<String> matches = jdbc.query("SELECT delete_token_hash FROM anonymous_reviews WHERE id = ? FOR UPDATE",
                (rs, index) -> rs.getString(1), id);
        if (matches.isEmpty() || !MessageDigest.isEqual(matches.getFirst().getBytes(StandardCharsets.US_ASCII),
                SubmissionAccessService.hash(token).getBytes(StandardCharsets.US_ASCII))) throw notFound();
        jdbc.update("DELETE FROM anonymous_reviews WHERE id = ?", id);
    }

    @Transactional
    public void deleteAdmin(String id) {
        if (jdbc.update("DELETE FROM anonymous_reviews WHERE id = ?", id) == 0) throw notFound();
    }

    private Map<String, String> marketerNames() {
        Map<String, String> names = new LinkedHashMap<>();
        programs.findAll("", "all", "all", "recommended").items().stream()
                .filter(program -> "MARKETER".equals(program.board()))
                .forEach(program -> names.put(program.slug(), program.name()));
        return names;
    }

    private Program requireMarketer(String slug) {
        Program program = programs.findBySlug(slug);
        if (!"MARKETER".equals(program.board())) throw notFoundProgram();
        return program;
    }

    private static String text(String raw, int min, int max, String field) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() < min || value.length() > max) throw invalid(field + "은 " + min + "~" + max + "자로 작성해 주세요.");
        if (value.codePoints().anyMatch(code -> Character.isISOControl(code) && code != '\n' && code != '\r' && code != '\t')) {
            throw invalid(field + "에 허용되지 않는 문자가 포함되어 있습니다.");
        }
        return value;
    }

    private static double average(long sum, long count) { return count == 0 ? 0 : Math.round((double) sum / count * 10) / 10.0; }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "평가를 찾을 수 없거나 삭제 키가 올바르지 않습니다."); }
    private static ResponseStatusException notFoundProgram() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "평가할 수 있는 부업을 찾을 수 없습니다."); }

    public record ReviewInput(JsonNode rating, String title, String content) {}
    public record Review(String id, String programSlug, String programName, int rating, String title, String content, String nickname, String createdAt) {}
    public record CreatedReview(Review review, String deleteToken) {}
    public record ReviewPage(List<Review> items, long total, int page, int size) {}
    public record ProgramSummary(String programSlug, long reviewCount, double averageRating) {}
    public record Summary(long totalReviews, double averageRating, List<ProgramSummary> programs) {}
    private record Aggregate(long count, long sum) {}
}
