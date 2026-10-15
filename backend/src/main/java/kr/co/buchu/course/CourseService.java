package kr.co.buchu.course;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import static kr.co.buchu.course.CourseModels.*;

@Service
public class CourseService {
    private static final Set<String> CATEGORIES = Set.of("AFFILIATE", "CONTENT", "COMMERCE", "DIGITAL", "SERVICE", "AI");
    private static final Set<String> LEVELS = Set.of("BEGINNER", "INTERMEDIATE");
    private static final Set<String> STATUSES = Set.of("DRAFT", "COMING_SOON", "PUBLISHED", "ARCHIVED");
    private static final Set<String> PUBLIC_STATUSES = Set.of("COMING_SOON", "PUBLISHED");
    private static final Pattern HTML = Pattern.compile("(?is)<\\s*/?\\s*[a-z][^>]*>");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CourseService(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    @Transactional(readOnly = true)
    public CoursePage listPublic() {
        List<Course> items = jdbc.query("SELECT * FROM courses WHERE status IN ('COMING_SOON', 'PUBLISHED') ORDER BY created_at ASC, id ASC", this::map)
                .stream().map(CourseService::publicView).toList();
        return new CoursePage(items, items.size());
    }

    @Transactional(readOnly = true)
    public AdminCoursePage listAdmin() {
        List<AdminCourse> items = jdbc.query("SELECT * FROM courses ORDER BY updated_at DESC, id ASC", this::map);
        return new AdminCoursePage(items, items.size());
    }

    @Transactional(readOnly = true)
    public Course publicCourseBySlug(String slug) { return publicView(findPublicBySlug(slug)); }

    @Transactional(readOnly = true)
    public AdminCourse findById(String id) {
        List<AdminCourse> matches = jdbc.query("SELECT * FROM courses WHERE id = ?", this::map, id);
        if (matches.isEmpty()) throw notFound();
        return matches.getFirst();
    }

    @Transactional(readOnly = true)
    public AdminCourse findPublishedById(String id) {
        AdminCourse course = findById(id);
        if (!"PUBLISHED".equals(course.status()) || course.isDemo()) throw notFound();
        return course;
    }

    @Transactional(readOnly = true)
    public LessonContent lessonForCourse(String courseId, String lessonId) {
        return lesson(findById(courseId), lessonId);
    }

    @Transactional(readOnly = true)
    public LessonContent preview(String slug, String lessonId) {
        LessonContent content = lesson(findPublicBySlug(slug), lessonId);
        if (!content.preview()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "미리보기로 제공되지 않는 수업입니다.");
        return content;
    }

    @Transactional
    public AdminCourse create(CourseInput input) {
        CourseInput validated = validate(input);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String id = UUID.randomUUID().toString();
        ensureUniqueSlug(validated.slug(), id);
        try {
            jdbc.update("INSERT INTO courses (id, slug, payload, status, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    id, validated.slug(), json(validated), validated.status(), validated.isDemo(), now, now);
        } catch (DuplicateKeyException exception) { throw duplicateSlug(); }
        return findById(id);
    }

    @Transactional
    public AdminCourse update(String id, CourseInput input) {
        CourseInput validated = validate(input);
        // Serialize concurrent edits with checkout, and retain the immutable course identifier.
        List<String> matches = jdbc.query("SELECT id FROM courses WHERE id = ? FOR UPDATE", (rs, index) -> rs.getString(1), id);
        if (matches.isEmpty()) throw notFound();
        ensureUniqueSlug(validated.slug(), id);
        try {
            jdbc.update("UPDATE courses SET slug = ?, payload = ?, status = ?, is_demo = ?, updated_at = ? WHERE id = ?",
                    validated.slug(), json(validated), validated.status(), validated.isDemo(), OffsetDateTime.now(ZoneOffset.UTC), id);
        } catch (DuplicateKeyException exception) { throw duplicateSlug(); }
        return findById(id);
    }

    private AdminCourse findPublicBySlug(String slug) {
        List<AdminCourse> matches = jdbc.query("SELECT * FROM courses WHERE slug = ? AND status IN ('COMING_SOON', 'PUBLISHED')", this::map, slug);
        if (matches.isEmpty()) throw notFound();
        return matches.getFirst();
    }

    private static LessonContent lesson(AdminCourse course, String lessonId) {
        for (AdminModule module : course.curriculum()) {
            for (AdminLesson lesson : module.lessons()) {
                if (lesson.id().equals(lessonId)) return new LessonContent(lesson.id(), lesson.title(), lesson.durationMinutes(), lesson.preview(), lesson.body(), lesson.videoUrl());
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "수업을 찾을 수 없습니다.");
    }

    public static Course publicView(AdminCourse course) {
        List<CourseModule> curriculum = course.curriculum().stream().map(module -> new CourseModule(module.id(), module.title(),
                module.lessons().stream().map(lesson -> new CourseLesson(lesson.id(), lesson.title(), lesson.durationMinutes(), lesson.preview())).toList())).toList();
        return new Course(course.id(), course.slug(), course.title(), course.subtitle(), course.description(), course.category(), course.level(), course.status(),
                course.isDemo(), course.instructorName(), course.instructorBio(), course.thumbnailUrl(), course.refundPolicy(), course.supportEmail(), course.price(), course.accessDays(), course.weeklyHours(), course.startupCost(),
                course.outcomes(), course.requirements(), course.relatedProgramSlug(), curriculum, course.createdAt(), course.updatedAt());
    }

    private AdminCourse map(ResultSet row, int index) throws SQLException {
        try {
            CourseInput data = mapper.readValue(row.getString("payload"), CourseInput.class);
            return new AdminCourse(row.getString("id"), row.getString("slug"), data.title(), data.subtitle(), data.description(), data.category(), data.level(), row.getString("status"),
                    row.getBoolean("is_demo"), data.instructorName(), data.instructorBio(), data.thumbnailUrl(), data.refundPolicy(), data.supportEmail(), data.price(), data.accessDays(), data.weeklyHours(), data.startupCost(),
                    data.outcomes(), data.requirements(), data.relatedProgramSlug(), data.curriculum(), row.getTimestamp("created_at").toInstant().toString(), row.getTimestamp("updated_at").toInstant().toString());
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Invalid stored course", exception); }
    }

    private CourseInput validate(CourseInput input) {
        if (input == null) throw invalid("강의 정보를 입력해 주세요.");
        String slug = text(input.slug(), 3, 120, "강의 주소");
        if (!slug.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) throw invalid("강의 주소는 영문 소문자, 숫자, 하이픈으로 입력해 주세요.");
        String title = text(input.title(), 3, 160, "강의 제목");
        String subtitle = text(input.subtitle(), 0, 240, "한 줄 소개");
        String status = option(input.status(), STATUSES, "공개 상태");
        boolean published = "PUBLISHED".equals(status);
        if (input.isDemo() == null) throw invalid("기획 예시 여부를 선택해 주세요.");
        if (published && input.isDemo()) throw invalid("기획 예시는 판매할 수 없습니다. 실제 강의 콘텐츠를 준비한 후 예시 표시를 해제해 주세요.");
        String description = text(input.description(), published ? 20 : 0, 12000, "강의 소개");
        String instructorName = text(input.instructorName(), published ? 2 : 0, 100, "강사 이름");
        String instructorBio = text(input.instructorBio(), published ? 10 : 0, 3000, "강사 소개");
        String refundPolicy = text(input.refundPolicy(), published ? 20 : 0, 5000, "환불 안내");
        String supportEmail = text(input.supportEmail(), published ? 3 : 0, 254, "문의 이메일");
        if (!supportEmail.isEmpty() && !EMAIL.matcher(supportEmail).matches()) throw invalid("문의 이메일 주소를 확인해 주세요.");
        String thumbnail = url(input.thumbnailUrl(), "썸네일");
        int price = integer(input.price(), published ? 1000 : 0, 10_000_000, "판매 가격");
        int accessDays = integer(input.accessDays(), 1, 3650, "수강 기간");
        int weeklyHours = integer(input.weeklyHours(), 1, 168, "주당 학습 시간");
        int startupCost = integer(input.startupCost(), 0, 100_000_000, "예상 준비 비용");
        List<String> outcomes = strings(input.outcomes(), published ? 1 : 0, "완성할 결과물");
        List<String> requirements = strings(input.requirements(), published ? 1 : 0, "준비물");
        String related = text(input.relatedProgramSlug(), 0, 100, "관련 부업 주소");
        if (!related.isEmpty() && !related.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) throw invalid("관련 부업 주소를 확인해 주세요.");
        if (input.curriculum() == null || input.curriculum().size() > 30 || (published && input.curriculum().isEmpty())) throw invalid("커리큘럼은 최대 30개 챕터까지 등록할 수 있으며 판매 전 하나 이상 필요합니다.");
        List<AdminModule> curriculum = new ArrayList<>();
        Set<String> moduleIds = new HashSet<>(), lessonIds = new HashSet<>();
        for (AdminModule module : input.curriculum()) {
            if (module == null) throw invalid("챕터 정보를 확인해 주세요.");
            String moduleId = identifier(module.id(), "챕터");
            if (!moduleIds.add(moduleId)) throw invalid("챕터 식별자가 중복되었습니다.");
            if (module.lessons() == null || module.lessons().size() > 50 || (published && module.lessons().isEmpty())) throw invalid("챕터마다 최대 50개 수업까지 등록할 수 있으며 판매 전 하나 이상 필요합니다.");
            List<AdminLesson> lessons = new ArrayList<>();
            for (AdminLesson lesson : module.lessons()) {
                if (lesson == null) throw invalid("수업 정보를 확인해 주세요.");
                String lessonId = identifier(lesson.id(), "수업");
                if (!lessonIds.add(lessonId)) throw invalid("수업 식별자는 강의 전체에서 중복될 수 없습니다.");
                if (lessonIds.size() > 200) throw invalid("강의당 최대 200개 수업까지 등록할 수 있습니다.");
                if (lesson.preview() == null) throw invalid("미리보기 여부를 선택해 주세요.");
                String body = text(lesson.body(), 0, 50000, "수업 본문");
                String videoUrl = url(lesson.videoUrl(), "수업 영상");
                if (published && body.length() < 20 && videoUrl.isEmpty()) throw invalid("판매할 모든 수업에 20자 이상의 학습 본문 또는 영상이 필요합니다.");
                lessons.add(new AdminLesson(lessonId, text(lesson.title(), 1, 160, "수업 제목"), integer(lesson.durationMinutes(), 1, 600, "수업 시간"), lesson.preview(), body, videoUrl));
            }
            curriculum.add(new AdminModule(moduleId, text(module.title(), 1, 160, "챕터 제목"), List.copyOf(lessons)));
        }
        CourseInput result = new CourseInput(slug, title, subtitle, description, option(input.category(), CATEGORIES, "강의 주제"), option(input.level(), LEVELS, "난이도"), status,
                input.isDemo(), instructorName, instructorBio, thumbnail, refundPolicy, supportEmail, price, accessDays, weeklyHours, startupCost, outcomes, requirements,
                related.isEmpty() ? null : related, List.copyOf(curriculum));
        if (json(result).length() > 750_000) throw invalid("강의 전체 내용은 75만 자 이내로 등록해 주세요.");
        return result;
    }

    private void ensureUniqueSlug(String slug, String id) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM courses WHERE slug = ? AND id <> ?", Integer.class, slug, id);
        if (count != null && count > 0) throw duplicateSlug();
    }

    private String json(CourseInput input) {
        try { return mapper.writeValueAsString(input); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot serialize course", exception); }
    }

    private static List<String> strings(List<String> values, int min, String field) {
        if (values == null || values.size() < min || values.size() > 20) throw invalid(field + " 항목은 " + min + "~20개로 등록해 주세요.");
        return values.stream().map(value -> text(value, 1, 300, field)).toList();
    }

    private static String text(String raw, int min, int max, String field) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() < min || value.length() > max) throw invalid(field + "은 " + min + "~" + max + "자로 입력해 주세요.");
        if (HTML.matcher(value).find() || value.codePoints().anyMatch(code -> Character.isISOControl(code) && code != '\n' && code != '\r' && code != '\t')) {
            throw invalid(field + "은 HTML 없이 일반 텍스트로 작성해 주세요.");
        }
        return value;
    }

    private static String identifier(String value, String field) {
        String normalized = text(value, 1, 80, field + " 식별자");
        if (!normalized.matches("[a-zA-Z0-9_-]+")) throw invalid(field + " 식별자 형식을 확인해 주세요.");
        return normalized;
    }

    private static int integer(Integer value, int min, int max, String field) {
        if (value == null || value < min || value > max) throw invalid(field + "은 " + min + "~" + max + " 사이의 정수로 입력해 주세요.");
        return value;
    }

    private static String option(String value, Set<String> allowed, String field) {
        if (value == null || !allowed.contains(value)) throw invalid(field + "을 올바르게 선택해 주세요.");
        return value;
    }

    private static String url(String raw, String field) {
        String value = text(raw, 0, 2048, field + " 주소");
        if (value.isEmpty()) return value;
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null || uri.getFragment() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443) || !publicHost(host)) throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) { throw invalid(field + " 주소는 공개된 HTTPS 주소로 입력해 주세요."); }
        return value;
    }

    private static boolean publicHost(String raw) {
        String host = raw.toLowerCase(Locale.ROOT);
        if (!host.contains(".") || host.endsWith(".") || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")
                || host.contains(":")) return false;
        if (host.matches("[0-9.]+")) {
            String[] parts = host.split("\\.");
            if (parts.length != 4) return false;
            int[] numbers = new int[4];
            for (int index = 0; index < 4; index++) {
                try { numbers[index] = Integer.parseInt(parts[index]); } catch (NumberFormatException exception) { return false; }
                if (numbers[index] < 0 || numbers[index] > 255) return false;
            }
            int first = numbers[0], second = numbers[1];
            return first != 0 && first != 10 && first != 127 && first < 224
                    && !(first == 169 && second == 254) && !(first == 172 && second >= 16 && second <= 31)
                    && !(first == 192 && second == 168) && !(first == 100 && second >= 64 && second <= 127);
        }
        return host.matches("[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?");
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException duplicateSlug() { return new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 강의 주소입니다."); }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "강의를 찾을 수 없습니다."); }
}
