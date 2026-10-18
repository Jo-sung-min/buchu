package kr.co.buchu.ads;

import kr.co.buchu.submission.ContentPolicy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Side-rail sponsor tiles. Anyone can apply; the administrator approves after payment and the tile runs for N months. */
@Service
public class AdvertisementService {
    public static final int TOTAL_SLOTS = 10;
    public static final long MONTHLY_PRICE_KRW = 300_000;
    private static final Set<String> STATUSES = Set.of("PENDING", "APPROVED", "REJECTED", "ENDED");
    private static final String COLUMNS = "id, site_name, tagline, url, contact_email, color, status, note, created_at, starts_at, ends_at";
    private final JdbcTemplate jdbc;
    private final RowMapper<Advertisement> adminMapper = (rs, index) -> map(rs.getString("id"), rs.getString("site_name"), rs.getString("tagline"), rs.getString("url"),
            rs.getString("contact_email"), rs.getString("color"), rs.getString("status"), rs.getString("note"), rs.getTimestamp("created_at"), rs.getTimestamp("starts_at"), rs.getTimestamp("ends_at"));

    public AdvertisementService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public Advertisement apply(ApplyInput input) {
        if (input == null) throw invalid("신청 내용을 입력해 주세요.");
        String siteName = text(input.siteName(), 2, 40, "사이트 이름");
        String tagline = text(input.tagline(), 2, 60, "한 줄 소개");
        String url = text(input.url(), 8, 2000, "사이트 주소");
        if (!ContentPolicy.safeUrl(url, false)) throw invalid("사이트 주소는 http 또는 https 주소로 입력해 주세요.");
        String email = text(input.contactEmail(), 5, 254, "담당자 이메일");
        if (!email.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+")) throw invalid("담당자 이메일 형식을 확인해 주세요.");
        String color = input.color() == null || input.color().isBlank() ? "#25262B" : input.color().strip().toUpperCase();
        if (!color.matches("#[0-9A-F]{6}")) throw invalid("타일 색상은 #RRGGBB 형식으로 선택해 주세요.");
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO advertisements (id, site_name, tagline, url, contact_email, color, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', '', ?)",
                id, siteName, tagline, url, email, color, now);
        return new Advertisement(id, siteName, tagline, url, email, color, "PENDING", "", now.toInstant().toString(), null, null);
    }

    /** Public: running tiles only, oldest first so a sponsor keeps its place, and never the contact address. */
    @Transactional(readOnly = true)
    public Board board() {
        List<PublicAdvertisement> items = jdbc.query("SELECT " + COLUMNS + " FROM advertisements WHERE status = 'APPROVED' AND (ends_at IS NULL OR ends_at > ?) ORDER BY starts_at, id LIMIT ?",
                (rs, index) -> new PublicAdvertisement(rs.getString("id"), rs.getString("site_name"), rs.getString("tagline"), rs.getString("url"), rs.getString("color")),
                Timestamp.from(OffsetDateTime.now(ZoneOffset.UTC).toInstant()), TOTAL_SLOTS);
        return new Board(items, TOTAL_SLOTS, MONTHLY_PRICE_KRW);
    }

    @Transactional(readOnly = true)
    public AdminPage adminList(String status, int page, int size) {
        if (page < 0 || page > 100_000 || size < 1 || size > 100) throw invalid("페이지 크기는 1~100 사이로 입력해 주세요.");
        String selected = status == null || status.isBlank() || "ALL".equals(status) ? "" : status;
        if (!selected.isBlank() && !STATUSES.contains(selected)) throw invalid("상태 값을 확인해 주세요.");
        List<Object> args = new ArrayList<>();
        String where = selected.isBlank() ? "" : " WHERE status = ?";
        if (!selected.isBlank()) args.add(selected);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM advertisements" + where, Long.class, args.toArray());
        args.add(size); args.add(page * size);
        List<Advertisement> items = jdbc.query("SELECT " + COLUMNS + " FROM advertisements" + where + " ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END, created_at DESC, id DESC LIMIT ? OFFSET ?", adminMapper, args.toArray());
        long pending = jdbc.queryForObject("SELECT COUNT(*) FROM advertisements WHERE status = 'PENDING'", Long.class);
        long active = jdbc.queryForObject("SELECT COUNT(*) FROM advertisements WHERE status = 'APPROVED' AND (ends_at IS NULL OR ends_at > ?)", Long.class, Timestamp.from(OffsetDateTime.now(ZoneOffset.UTC).toInstant()));
        return new AdminPage(items, total, page, size, pending, active, TOTAL_SLOTS);
    }

    @Transactional
    public Advertisement approve(String id, Integer months, String note) {
        int period = months == null ? 1 : months;
        if (period < 1 || period > 12) throw invalid("게재 기간은 1~12개월 사이로 입력해 주세요.");
        Advertisement current = require(id);
        if (!"PENDING".equals(current.status())) throw invalid("대기 중인 신청만 승인할 수 있습니다.");
        long running = jdbc.queryForObject("SELECT COUNT(*) FROM advertisements WHERE status = 'APPROVED' AND (ends_at IS NULL OR ends_at > ?)", Long.class, Timestamp.from(OffsetDateTime.now(ZoneOffset.UTC).toInstant()));
        if (running >= TOTAL_SLOTS) throw invalid("빈 광고 자리가 없습니다. 먼저 종료할 광고를 정리해 주세요.");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("UPDATE advertisements SET status = 'APPROVED', note = ?, starts_at = ?, ends_at = ? WHERE id = ?", note(note), now, now.plusMonths(period), id);
        return require(id);
    }

    @Transactional
    public Advertisement reject(String id, String note) {
        Advertisement current = require(id);
        if (!"PENDING".equals(current.status())) throw invalid("대기 중인 신청만 거절할 수 있습니다.");
        String reason = note(note);
        if (reason.isBlank()) throw invalid("거절 사유를 입력해 주세요.");
        jdbc.update("UPDATE advertisements SET status = 'REJECTED', note = ? WHERE id = ?", reason, id);
        return require(id);
    }

    @Transactional
    public Advertisement end(String id) {
        Advertisement current = require(id);
        if (!"APPROVED".equals(current.status())) throw invalid("게재 중인 광고만 종료할 수 있습니다.");
        jdbc.update("UPDATE advertisements SET status = 'ENDED', ends_at = ? WHERE id = ?", OffsetDateTime.now(ZoneOffset.UTC), id);
        return require(id);
    }

    private Advertisement require(String id) {
        List<Advertisement> rows = jdbc.query("SELECT " + COLUMNS + " FROM advertisements WHERE id = ?", adminMapper, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "광고 신청을 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private static Advertisement map(String id, String siteName, String tagline, String url, String email, String color, String status, String note, Timestamp created, Timestamp starts, Timestamp ends) {
        return new Advertisement(id, siteName, tagline, url, email, color, status, note, created.toInstant().toString(),
                starts == null ? null : starts.toInstant().toString(), ends == null ? null : ends.toInstant().toString());
    }

    private static String note(String raw) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() > 500) throw invalid("메모는 500자 이내로 입력해 주세요.");
        return value;
    }

    private static String text(String raw, int min, int max, String field) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() < min || value.length() > max) throw invalid(field + "은 " + min + "~" + max + "자로 입력해 주세요.");
        if (value.codePoints().anyMatch(code -> Character.isISOControl(code))) throw invalid(field + "에 허용되지 않는 문자가 포함되어 있습니다.");
        return value;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

    public record ApplyInput(String siteName, String tagline, String url, String contactEmail, String color) {}
    public record DecisionInput(Integer months, String note) {}
    public record PublicAdvertisement(String id, String siteName, String tagline, String url, String color) {}
    public record Board(List<PublicAdvertisement> items, int totalSlots, long monthlyPriceKrw) {}
    public record Advertisement(String id, String siteName, String tagline, String url, String contactEmail, String color, String status, String note, String createdAt, String startsAt, String endsAt) {}
    public record AdminPage(List<Advertisement> items, long total, int page, int size, long pending, long active, int totalSlots) {}
}
