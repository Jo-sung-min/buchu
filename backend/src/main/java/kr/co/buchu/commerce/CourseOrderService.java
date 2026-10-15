package kr.co.buchu.commerce;

import com.fasterxml.jackson.databind.JsonNode;
import kr.co.buchu.course.CourseModels.AdminCourse;
import kr.co.buchu.course.CourseModels.Course;
import kr.co.buchu.course.CourseModels.LessonContent;
import kr.co.buchu.course.CourseService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class CourseOrderService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final JdbcTemplate jdbc;
    private final CourseService courses;
    private final PaymentProperties properties;
    private final PaymentProvider provider;
    private final SecureRandom random = new SecureRandom();

    public CourseOrderService(JdbcTemplate jdbc, CourseService courses, PaymentProperties properties, PaymentProvider provider) {
        this.jdbc = jdbc; this.courses = courses; this.properties = properties; this.provider = provider;
    }

    public PaymentConfig config() { return new PaymentConfig(properties.ready(), properties.ready() ? properties.getClientKey() : ""); }

    @Transactional
    public CreatedOrder create(CreateInput input) {
        requirePayments();
        if (input == null || input.consent() == null || !input.consent().isBoolean() || !input.consent().booleanValue()) {
            throw invalid("구매 및 개인정보 처리 안내에 동의해 주세요.");
        }
        String courseId = text(input.courseId(), 1, 36, "강의 정보");
        // Catalog edits use the same row lock, so checkout snapshots one consistent version.
        jdbc.query("SELECT id FROM courses WHERE id = ? FOR UPDATE", (rs, index) -> rs.getString(1), courseId);
        AdminCourse course = courses.findPublishedById(courseId);
        if (!"PUBLISHED".equals(course.status()) || course.isDemo() || course.price() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "아직 구매할 수 없는 강의입니다.");
        }
        String name = text(input.buyerName(), 1, 80, "구매자 이름");
        String email = text(input.buyerEmail(), 3, 254, "이메일");
        if (!EMAIL.matcher(email).matches()) throw invalid("이메일 형식을 확인해 주세요.");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        // Price, access period and course identity are exclusively sourced from the catalog.
        jdbc.update("INSERT INTO course_orders (id, course_id, course_slug, course_title, amount, access_days, status, buyer_name, buyer_email, access_token_hash, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)",
                id, course.id(), course.slug(), course.title(), course.price(), course.accessDays(), name, email, hash(token), now, now);
        return new CreatedOrder(view(row(id, false)), token);
    }

    @Transactional(readOnly = true)
    public CourseOrder get(String id, String token) { return view(owned(id, token, false)); }

    @Transactional
    public CourseOrder confirm(String id, String token, ConfirmInput input) {
        OrderRow row = owned(id, token, true);
        if (input == null || input.amount() == null || !input.amount().isIntegralNumber()
                || !input.amount().canConvertToInt() || input.amount().intValue() != row.amount()) {
            throw invalid("주문 금액이 일치하지 않습니다. 주문 내용을 다시 확인해 주세요.");
        }
        String paymentKey = text(input.paymentKey(), 1, 200, "결제 정보");
        if (!paymentKey.matches("[A-Za-z0-9_=-]+")) throw invalid("결제 정보 형식을 확인해 주세요.");
        if ("PAID".equals(row.status())) {
            if (!paymentKey.equals(row.paymentKey())) throw invalid("주문에 연결된 결제 정보가 다릅니다.");
            return view(row);
        }
        if (!"PENDING".equals(row.status())) throw new ResponseStatusException(HttpStatus.CONFLICT, "취소된 주문은 결제할 수 없습니다.");
        requirePayments();
        Long duplicate = jdbc.queryForObject("SELECT COUNT(*) FROM course_orders WHERE payment_key = ? AND id <> ?", Long.class, paymentKey, id);
        if (duplicate != null && duplicate > 0) throw invalid("이미 다른 주문에 사용된 결제 정보입니다.");
        PaymentProvider.Payment payment;
        try { payment = provider.confirm(row.id(), paymentKey, row.amount()); }
        catch (PaymentProvider.Unavailable ignored) { throw providerUnavailable(); }
        verifyIdentity(row, payment, paymentKey);
        if (!"DONE".equals(payment.status()) || payment.balanceAmount() != row.amount() || payment.approvedAt() == null
                || payment.approvedAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(5))) {
            throw providerMismatch();
        }
        OffsetDateTime paidAt = payment.approvedAt();
        try {
            jdbc.update("UPDATE course_orders SET status = 'PAID', payment_key = ?, paid_at = ?, expires_at = ? WHERE id = ?",
                    paymentKey, paidAt, paidAt.plusDays(row.accessDays()), id);
        } catch (DataIntegrityViolationException ignored) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "결제 정보가 이미 처리되었습니다. 주문 내역을 확인해 주세요.");
        }
        return view(row(id, false));
    }

    @Transactional(readOnly = true)
    public Course course(String id, String token) {
        OrderRow row = owned(id, token, false);
        requireAccess(row);
        return CourseService.publicView(courses.findById(row.courseId()));
    }

    @Transactional(readOnly = true)
    public LessonContent lesson(String id, String token, String lessonId) {
        OrderRow row = owned(id, token, false);
        requireAccess(row);
        return courses.lessonForCourse(row.courseId(), lessonId);
    }

    @Transactional
    public CourseOrder progress(String id, String token, String lessonId, ProgressInput input) {
        OrderRow row = owned(id, token, true);
        requireAccess(row);
        courses.lessonForCourse(row.courseId(), lessonId);
        if (input == null || input.completed() == null || !input.completed().isBoolean()) throw invalid("수강 완료 여부를 확인해 주세요.");
        jdbc.update("DELETE FROM course_lesson_progress WHERE order_id = ? AND lesson_id = ?", id, lessonId);
        if (input.completed().booleanValue()) jdbc.update("INSERT INTO course_lesson_progress (order_id, lesson_id, completed_at) VALUES (?, ?, ?)",
                id, lessonId, OffsetDateTime.now(ZoneOffset.UTC));
        return view(row);
    }

    @Transactional(readOnly = true)
    public OrderPage adminList(int page, int size, String status) {
        if (page < 0 || page > 100_000 || size < 1 || size > 100) throw invalid("페이지 정보를 확인해 주세요.");
        String selected = status == null ? "" : status.trim();
        if (!selected.isEmpty() && !Set.of("PENDING", "PAID", "CANCELED").contains(selected)) throw invalid("주문 상태를 확인해 주세요.");
        String where = selected.isEmpty() ? "" : " WHERE status = ?";
        List<Object> args = new ArrayList<>();
        if (!selected.isEmpty()) args.add(selected);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM course_orders" + where, Long.class, args.toArray());
        args.add(size); args.add(page * size);
        List<CourseOrder> items = jdbc.query("SELECT * FROM course_orders" + where + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (rs, index) -> readRow(rs), args.toArray()).stream().map(this::view).toList();
        return new OrderPage(items, total);
    }

    @Transactional
    public CourseOrder cancel(String id, CancelInput input) {
        OrderRow row = row(id, true);
        if (input == null) throw invalid("취소 사유를 입력해 주세요.");
        String reason = text(input.reason(), 3, 200, "취소 사유");
        if ("CANCELED".equals(row.status())) return view(row);
        if (!"PAID".equals(row.status())) throw new ResponseStatusException(HttpStatus.CONFLICT, "결제 완료 주문만 환불할 수 있습니다.");
        if (properties.getSecretKey().isBlank()) throw providerUnavailable();
        PaymentProvider.Payment payment;
        try { payment = provider.cancel(id, row.paymentKey(), reason); }
        catch (PaymentProvider.Unavailable ignored) { throw providerUnavailable(); }
        verifyIdentity(row, payment, row.paymentKey());
        if (!"CANCELED".equals(payment.status()) || payment.balanceAmount() != 0) throw providerMismatch();
        jdbc.update("UPDATE course_orders SET status = 'CANCELED', canceled_at = ?, cancel_reason = ? WHERE id = ?",
                OffsetDateTime.now(ZoneOffset.UTC), reason, id);
        return view(row(id, false));
    }

    @Transactional
    public void reconcileWebhook(String orderId, String paymentKey) {
        // The webhook is only a lookup hint. Its status, amount and timestamps are never trusted.
        List<OrderRow> matches = jdbc.query("SELECT * FROM course_orders WHERE id = ? AND payment_key = ? FOR UPDATE",
                (rs, index) -> readRow(rs), orderId, paymentKey);
        if (matches.isEmpty() || !"PAID".equals(matches.getFirst().status())) return;
        OrderRow row = matches.getFirst();
        PaymentProvider.Payment payment = lookup(row.id());
        verifyIdentity(row, payment, row.paymentKey());
        if ("CANCELED".equals(payment.status()) && payment.balanceAmount() == 0) {
            jdbc.update("UPDATE course_orders SET status = 'CANCELED', canceled_at = ?, cancel_reason = ? WHERE id = ?",
                    OffsetDateTime.now(ZoneOffset.UTC), "결제사 전액 취소 확인", row.id());
        }
        // No PAID transition here. Partial refunds require a future explicit product policy.
    }

    private PaymentProvider.Payment lookup(String orderId) {
        try { return provider.lookup(orderId); }
        catch (PaymentProvider.Unavailable ignored) { throw providerUnavailable(); }
    }

    private void verifyIdentity(OrderRow row, PaymentProvider.Payment payment, String paymentKey) {
        if (payment == null || !row.id().equals(payment.orderId()) || !paymentKey.equals(payment.paymentKey())
                || payment.totalAmount() != row.amount() || !"KRW".equals(payment.currency())) throw providerMismatch();
    }

    private OrderRow owned(String id, String token, boolean lock) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw missing();
        OrderRow row = row(id, lock);
        if (!MessageDigest.isEqual(hash(token).getBytes(StandardCharsets.UTF_8), row.tokenHash().getBytes(StandardCharsets.UTF_8))) throw missing();
        return row;
    }

    private OrderRow row(String id, boolean lock) {
        if (id == null || !id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw missing();
        List<OrderRow> rows = jdbc.query("SELECT * FROM course_orders WHERE id = ?" + (lock ? " FOR UPDATE" : ""), (rs, index) -> readRow(rs), id);
        if (rows.isEmpty()) throw missing();
        return rows.getFirst();
    }

    private static OrderRow readRow(ResultSet rs) throws SQLException {
        return new OrderRow(rs.getString("id"), rs.getString("course_id"), rs.getString("course_slug"), rs.getString("course_title"),
                rs.getInt("amount"), rs.getInt("access_days"), rs.getString("status"), rs.getString("buyer_name"), rs.getString("buyer_email"),
                rs.getString("access_token_hash"), rs.getString("payment_key"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("paid_at", OffsetDateTime.class), rs.getObject("expires_at", OffsetDateTime.class));
    }

    private CourseOrder view(OrderRow row) {
        List<String> completed = jdbc.queryForList("SELECT lesson_id FROM course_lesson_progress WHERE order_id = ? ORDER BY completed_at, lesson_id", String.class, row.id());
        return new CourseOrder(row.id(), row.courseId(), row.courseSlug(), row.courseTitle(), row.amount(), row.status(), row.buyerName(), row.buyerEmail(),
                timestamp(row.createdAt()), timestamp(row.paidAt()), timestamp(row.expiresAt()), completed);
    }

    private void requireAccess(OrderRow row) {
        if (!"PAID".equals(row.status())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "결제를 완료한 강의만 수강할 수 있습니다.");
        if (row.expiresAt() == null || !row.expiresAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "수강 기간이 만료되었습니다.");
        // Fail closed if a refund was made externally or its webhook has not arrived yet.
        // Do not write status here: a subsequent denial would roll back that update.
        PaymentProvider.Payment payment = lookup(row.id());
        verifyIdentity(row, payment, row.paymentKey());
        if (!"DONE".equals(payment.status()) || payment.balanceAmount() != row.amount()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "결제 상태가 변경되어 수강할 수 없습니다. 주문 문의처로 연락해 주세요.");
        }
    }

    private void requirePayments() {
        if (!properties.ready()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "결제 서비스 준비 중입니다. 현재는 결제할 수 없습니다.");
    }

    private static String timestamp(OffsetDateTime time) { return time == null ? null : time.toInstant().toString(); }
    private static String text(String value, int min, int max, String label) {
        String clean = value == null ? "" : value.trim();
        if (clean.length() < min || clean.length() > max || clean.chars().anyMatch(Character::isISOControl)) throw invalid(label + " 입력을 확인해 주세요.");
        return clean;
    }
    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "주문 정보와 수강 코드를 확인해 주세요."); }
    private static ResponseStatusException providerUnavailable() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "결제 결과를 확인하지 못했습니다. 같은 주문으로 다시 확인해 주세요."); }
    private static ResponseStatusException providerMismatch() { return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "결제 정보가 주문과 일치하지 않아 처리하지 않았습니다."); }

    public record PaymentConfig(boolean enabled, String clientKey) {}
    public record CreateInput(String courseId, String buyerName, String buyerEmail, JsonNode consent) {}
    public record ConfirmInput(String paymentKey, JsonNode amount) {}
    public record ProgressInput(JsonNode completed) {}
    public record CancelInput(String reason) {}
    public record CourseOrder(String id, String courseId, String courseSlug, String courseTitle, int amount, String status,
                              String buyerName, String buyerEmail, String createdAt, String paidAt, String expiresAt, List<String> completedLessonIds) {}
    public record CreatedOrder(CourseOrder order, String accessToken) {}
    public record OrderPage(List<CourseOrder> items, long total) {}
    private record OrderRow(String id, String courseId, String courseSlug, String courseTitle, int amount, int accessDays, String status,
                            String buyerName, String buyerEmail, String tokenHash, String paymentKey, OffsetDateTime createdAt, OffsetDateTime paidAt, OffsetDateTime expiresAt) {}
}
