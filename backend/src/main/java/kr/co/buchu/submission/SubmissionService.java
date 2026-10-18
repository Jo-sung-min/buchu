package kr.co.buchu.submission;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import kr.co.buchu.program.Program;
import kr.co.buchu.storage.UploadService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class SubmissionService {
    private static final Set<String> STATUSES = Set.of("DRAFT", "PENDING", "APPROVED", "REJECTED");
    private static final Set<String> CHANNELS = Set.of("blog", "sns", "video", "website");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final SubmissionAccessService access;
    private final UploadService uploads;
    private final ContentPolicy contentPolicy;
    private final SecureRandom random = new SecureRandom();

    public SubmissionService(JdbcTemplate jdbc, ObjectMapper mapper, SubmissionAccessService access,
                             UploadService uploads, ContentPolicy contentPolicy) {
        this.jdbc = jdbc; this.mapper = mapper; this.access = access; this.uploads = uploads; this.contentPolicy = contentPolicy;
    }

    @Transactional
    public DraftResponse createDraft() {
        String id = UUID.randomUUID().toString();
        byte[] secret = new byte[32]; random.nextBytes(secret);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        SubmissionInput input = normalize(new SubmissionInput(null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null));
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO submissions (id, access_token_hash, status, payload_json, content_json, created_at, updated_at) VALUES (?, ?, 'DRAFT', ?, ?, ?, ?)",
                id, SubmissionAccessService.hash(token), payload(input), json(input.content()), now, now);
        return new DraftResponse(id, token, "DRAFT");
    }

    @Transactional(readOnly = true)
    public ObjectNode getOwned(String id, String token) {
        access.requireOwner(id, token);
        return privateView(find(id, false), false);
    }

    @Transactional
    public ObjectNode save(String id, String token, SubmissionInput raw) {
        access.requireEditable(id, token);
        SubmissionInput input = normalize(raw);
        validateUploads(id, input);
        jdbc.update("UPDATE submissions SET company_name = ?, program_name = ?, board = ?, payload_json = ?, content_json = ?, updated_at = ? WHERE id = ?",
                input.companyName(), input.name(), input.board(), payload(input), json(input.content()), OffsetDateTime.now(ZoneOffset.UTC), id);
        return privateView(find(id, false), false);
    }

    @Transactional
    public ObjectNode submit(String id, String token) {
        access.requireEditable(id, token);
        Row row = find(id, false);
        SubmissionInput input = input(row);
        validateRequired(input);
        validateUploads(id, input);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("UPDATE submissions SET status = 'PENDING', submitted_at = ?, updated_at = ?, reviewed_at = NULL, review_note = NULL WHERE id = ?",
                now, now, id);
        return privateView(find(id, false), false);
    }

    @Transactional(readOnly = true)
    public AdminList listAdmin(String status, String query, int page, int size) {
        String selected = status == null ? "PENDING" : status.toUpperCase(Locale.ROOT);
        if (!selected.equals("ALL") && !STATUSES.contains(selected)) throw invalid("지원하지 않는 신청 상태입니다.");
        if (page < 0 || page > 100_000 || size < 1 || size > 100) throw invalid("페이지 크기는 1~100 사이로 입력해 주세요.");
        String q = text(query, 120, "검색어").toLowerCase(Locale.ROOT);
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (!selected.equals("ALL")) { where.append(" AND status = ?"); args.add(selected); }
        if (!q.isBlank()) { where.append(" AND (LOWER(company_name) LIKE ? OR LOWER(program_name) LIKE ?)"); args.add("%" + q + "%"); args.add("%" + q + "%"); }
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM submissions" + where, Long.class, args.toArray());
        args.add(size); args.add(page * size);
        List<ObjectNode> items = jdbc.query("SELECT * FROM submissions" + where + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", rows(), args.toArray())
                .stream().map(row -> privateView(row, false)).toList();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String key : List.of("DRAFT", "PENDING", "APPROVED", "REJECTED")) counts.put(key, 0L);
        jdbc.query("SELECT status, COUNT(*) AS total FROM submissions GROUP BY status", rs -> {
            counts.put(rs.getString("status"), rs.getLong("total"));
        });
        return new AdminList(items, total, page, size, counts);
    }

    @Transactional(readOnly = true)
    public ObjectNode getAdmin(String id) { return privateView(find(id, false), true); }

    @Transactional
    public ObjectNode review(String id, ReviewInput review, String reviewer) {
        Row row = find(id, true);
        if (!row.status.equals("PENDING")) throw new ResponseStatusException(HttpStatus.CONFLICT, "심사 대기 중인 신청만 처리할 수 있습니다.");
        if (!Set.of("APPROVED", "REJECTED").contains(review.decision == null ? "" : review.decision)) throw invalid("승인 또는 거절을 선택해 주세요.");
        String note = text(review.note, 2000, "심사 의견");
        if (review.decision.equals("REJECTED") && note.isBlank()) throw invalid("거절 사유를 입력해 주세요.");
        String slug = null;
        if (review.decision.equals("APPROVED")) {
            SubmissionInput input = input(row);
            validateRequired(input);
            validateUploads(id, input);
            Set<String> publishedUploads = new HashSet<>(contentPolicy.uploadIds(input.content()));
            publishedUploads.add(input.thumbnailUploadId());
            uploads.publish(id, publishedUploads);
            slug = "partner-" + id;
        }
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("UPDATE submissions SET status = ?, reviewed_at = ?, review_note = ?, updated_at = ?, published_slug = ? WHERE id = ?",
                review.decision, now, note, now, slug, id);
        jdbc.update("INSERT INTO review_events (id, submission_id, decision, note, reviewed_at, reviewed_by) VALUES (?, ?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(), id, review.decision, note, now, reviewer);
        return privateView(find(id, false), true);
    }

    @Transactional(readOnly = true)
    public List<Program> approvedPrograms() {
        return jdbc.query("SELECT * FROM submissions WHERE status = 'APPROVED' ORDER BY reviewed_at DESC", rows())
                .stream().map(this::publicProgram).toList();
    }

    private Program publicProgram(Row row) {
        SubmissionInput input = input(row);
        String initials = input.name().codePoints().limit(2).collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString();
        return new Program(row.publishedSlug, input.name(), input.tagline(), input.description(), input.category(), input.channels(),
                input.cost(), input.costLabel(), input.commission(), input.settlement(), "beginner", false,
                input.officialUrl(), input.officialUrl(), "#168d5d", initials, input.tags(),
                List.of(input.tagline()), "HELP".equals(input.board())
                    ? List.of("등록된 상세 내용을 확인해 주세요.", "공식 사이트에서 문의 또는 지원해 주세요.")
                    : List.of("공식 사이트에서 참여 조건을 확인해 주세요.", "가입 후 발급된 링크로 마케팅을 시작하세요."),
                "HELP".equals(input.board()) ? List.of("모집 조건과 보상 기준은 등록 기업에 직접 확인해 주세요.")
                    : List.of("수익은 보장되지 않으며, 참여 조건과 정산 기준은 공식 사이트에서 확인해 주세요."),
                row.reviewedAt == null ? null : row.reviewedAt.substring(0, 10), input.companyName(),
                uploads.publicUrl(input.thumbnailUploadId()), contentPolicy.withImageUrls(input.content(), uploads::publicUrl),
                input.board(), input.helpType(), input.location(), input.deadline());
    }

    private ObjectNode privateView(Row row, boolean includeReviews) {
        SubmissionInput input = input(row);
        ObjectNode result = mapper.valueToTree(input);
        result.put("id", row.id).put("status", row.status).put("createdAt", row.createdAt).put("updatedAt", row.updatedAt);
        result.put("submittedAt", row.submittedAt).put("reviewedAt", row.reviewedAt).put("reviewNote", row.reviewNote).put("publishedSlug", row.publishedSlug);
        result.put("thumbnailUrl", input.thumbnailUploadId().isBlank() ? null : uploads.previewUrl(input.thumbnailUploadId()));
        result.set("content", contentPolicy.withImageUrls(input.content(), uploads::previewUrl));
        if (includeReviews) {
            var events = jdbc.query("SELECT decision, note, reviewed_at, reviewed_by FROM review_events WHERE submission_id = ? ORDER BY reviewed_at, id",
                    (rs, index) -> new ReviewEvent(rs.getString("decision"), rs.getString("note"), instant(rs, "reviewed_at"), rs.getString("reviewed_by")), row.id);
            result.set("reviewEvents", mapper.valueToTree(events));
        }
        return result;
    }

    private SubmissionInput normalize(SubmissionInput value) {
        if (value == null) throw invalid("신청 내용을 입력해 주세요.");
        if (!Set.of("MARKETER", "HELP").contains(value.board())) throw invalid("게시할 탭을 확인해 주세요.");
        if ("HELP".equals(value.board()) && !Set.of("PROMOTION", "RECRUITMENT").contains(value.helpType())) throw invalid("홍보 또는 인재 모집을 선택해 주세요.");
        String deadline = text(value.deadline(), 10, "마감일");
        if (!deadline.isBlank()) {
            try {
                if (!deadline.matches("\\d{4}-\\d{2}-\\d{2}")) throw new DateTimeParseException("Invalid date format", deadline, 0);
                LocalDate.parse(deadline);
            } catch (DateTimeParseException exception) { throw invalid("마감일은 올바른 날짜(YYYY-MM-DD)로 입력해 주세요."); }
        }
        List<String> channels = choices(value.channels(), CHANNELS, 4, "홍보 채널");
        List<String> tags = value.tags() == null ? List.of() : value.tags().stream().map(tag -> text(tag, 30, "태그")).filter(tag -> !tag.isBlank()).distinct().toList();
        if (tags.size() > 10 || (value.tags() != null && value.tags().size() > 10)) throw invalid("태그는 10개까지 등록할 수 있습니다.");
        String category = value.category() == null || value.category().isBlank() ? "affiliate" : value.category();
        String cost = value.cost() == null || value.cost().isBlank() ? "check" : value.cost();
        if (!Set.of("affiliate", "campaign", "content", "commerce", "gig", "home", "apptech").contains(category) || !Set.of("free", "check").contains(cost)) throw invalid("분류 또는 참여 비용을 확인해 주세요.");
        String email = text(value.contactEmail(), 254, "담당자 이메일");
        if (!email.isBlank() && !email.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+")) throw invalid("담당자 이메일 형식을 확인해 주세요.");
        String url = text(value.officialUrl(), 2000, "공식 사이트 주소");
        if (!url.isBlank() && !ContentPolicy.safeUrl(url, false)) throw invalid("공식 사이트 주소는 http 또는 https 주소로 입력해 주세요.");
        String thumbnail = text(value.thumbnailUploadId(), 36, "대표 이미지");
        if (!thumbnail.isBlank() && !thumbnail.matches("[a-fA-F0-9-]{36}")) throw invalid("대표 이미지 업로드 정보가 올바르지 않습니다.");
        return new SubmissionInput(text(value.companyName(), 120, "기업명"), text(value.businessNumber(), 30, "사업자등록번호"),
                text(value.contactName(), 80, "담당자 이름"), email, text(value.contactPhone(), 40, "연락처"),
                text(value.name(), 120, "프로그램 이름"), text(value.tagline(), 180, "한 줄 소개"), text(value.description(), 1000, "프로그램 소개"),
                url, category, channels, cost, text(value.costLabel(), 120, "참여 비용 설명"), text(value.commission(), 300, "수익 구조"),
                text(value.settlement(), 300, "정산 기준"), thumbnail, contentPolicy.normalize(value.content()), tags,
                value.board(), value.helpType(), text(value.location(), 120, "활동 지역"), deadline);
    }

    private void validateRequired(SubmissionInput input) {
        Map<String, String> required = new LinkedHashMap<>();
        required.put("기업명", input.companyName()); required.put("담당자 이름", input.contactName()); required.put("담당자 이메일", input.contactEmail());
        required.put("프로그램 이름", input.name()); required.put("한 줄 소개", input.tagline()); required.put("프로그램 소개", input.description());
        required.put("공식 사이트 주소", input.officialUrl()); required.put("수익 구조", input.commission()); required.put("정산 기준", input.settlement());
        required.put("대표 이미지", input.thumbnailUploadId());
        for (var field : required.entrySet()) if (field.getValue() == null || field.getValue().isBlank()) throw invalid(field.getKey() + " 항목을 입력해 주세요.");
        if (input.channels().isEmpty()) throw invalid("홍보 채널을 하나 이상 선택해 주세요.");
        if (!contentPolicy.hasContent(input.content())) throw invalid("상세 설명을 작성해 주세요.");
    }

    private void validateUploads(String id, SubmissionInput input) {
        Set<String> uploadIds = new HashSet<>(contentPolicy.uploadIds(input.content()));
        if (!input.thumbnailUploadId().isBlank()) uploadIds.add(input.thumbnailUploadId());
        uploads.validateReady(id, uploadIds);
    }

    private String payload(SubmissionInput input) {
        ObjectNode payload = mapper.valueToTree(input);
        payload.remove("content");
        return json(payload);
    }

    private SubmissionInput input(Row row) {
        try {
            ObjectNode payload = (ObjectNode) mapper.readTree(row.payloadJson);
            payload.set("content", mapper.readTree(row.contentJson));
            return mapper.treeToValue(payload, SubmissionInput.class);
        } catch (JsonProcessingException e) { throw new IllegalStateException("저장된 신청 정보를 읽을 수 없습니다.", e); }
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }

    private Row find(String id, boolean lock) {
        List<Row> matches = jdbc.query("SELECT * FROM submissions WHERE id = ?" + (lock ? " FOR UPDATE" : ""), rows(), id);
        if (matches.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "신청 정보를 찾을 수 없습니다.");
        return matches.getFirst();
    }

    private static RowMapper<Row> rows() {
        return (rs, index) -> new Row(rs.getString("id"), rs.getString("status"), rs.getString("payload_json"), rs.getString("content_json"),
                instant(rs, "created_at"), instant(rs, "updated_at"), instant(rs, "submitted_at"), instant(rs, "reviewed_at"), rs.getString("review_note"), rs.getString("published_slug"));
    }

    private static String instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant().toString();
    }

    private static String text(String value, int max, String field) {
        String result = value == null ? "" : value.trim();
        if (result.length() > max) throw invalid(field + " 항목은 " + max + "자 이내로 입력해 주세요.");
        if (result.indexOf('\0') >= 0) throw invalid(field + " 항목에 허용되지 않는 문자가 포함되어 있습니다.");
        return result;
    }

    private static List<String> choices(List<String> values, Set<String> allowed, int max, String field) {
        if (values == null) return List.of();
        if (values.size() > max || values.stream().anyMatch(value -> value == null || !allowed.contains(value))) throw invalid(field + " 항목을 확인해 주세요.");
        return values.stream().distinct().toList();
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

    private record Row(String id, String status, String payloadJson, String contentJson, String createdAt, String updatedAt,
                       String submittedAt, String reviewedAt, String reviewNote, String publishedSlug) {}
    public record DraftResponse(String id, String accessToken, String status) {}
    public record ReviewInput(String decision, String note) {}
    public record ReviewEvent(String decision, String note, String reviewedAt, String reviewedBy) {}
    public record AdminList(List<ObjectNode> items, long total, int page, int size, Map<String, Long> counts) {}
}

