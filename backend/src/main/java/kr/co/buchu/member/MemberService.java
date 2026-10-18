package kr.co.buchu.member;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Members sign up with an id, password and a nickname that posts carry instead of the anonymous "ㅇㅇ(ip)" label. */
@Service
public class MemberService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;

    public MemberService(JdbcTemplate jdbc, PasswordEncoder passwords) { this.jdbc = jdbc; this.passwords = passwords; }

    @Transactional
    public Member register(RegisterInput input) {
        if (input == null) throw invalid("가입 정보를 입력해 주세요.");
        String username = input.username() == null ? "" : input.username().strip().toLowerCase();
        if (!username.matches("[a-z0-9_]{4,20}")) throw invalid("아이디는 영문 소문자, 숫자, 밑줄 4~20자로 입력해 주세요.");
        String password = input.password() == null ? "" : input.password();
        if (password.length() < 8 || password.length() > 72) throw invalid("비밀번호는 8~72자로 입력해 주세요.");
        if (password.chars().anyMatch(Character::isISOControl)) throw invalid("비밀번호에 허용되지 않는 문자가 포함되어 있습니다.");
        String nickname = nickname(input.nickname());
        if (jdbc.queryForObject("SELECT COUNT(*) FROM members WHERE username = ?", Integer.class, username) > 0) throw conflict("이미 사용 중인 아이디예요.");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM members WHERE LOWER(nickname) = LOWER(?)", Integer.class, nickname) > 0) throw conflict("이미 사용 중인 닉네임이에요.");
        String id = UUID.randomUUID().toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        try {
            jdbc.update("INSERT INTO members (id, username, password_hash, nickname, created_at) VALUES (?, ?, ?, ?, ?)", id, username, passwords.encode(password), nickname, now);
        } catch (DuplicateKeyException exception) { throw conflict("이미 사용 중인 아이디 또는 닉네임이에요."); }
        return new Member(id, username, nickname);
    }

    @Transactional(readOnly = true)
    public Optional<Member> authenticate(String username, String password) {
        String normalized = username == null ? "" : username.strip().toLowerCase();
        String supplied = password == null ? "" : password;
        if (normalized.isEmpty() || normalized.length() > 20 || supplied.isEmpty() || supplied.length() > 200) return Optional.empty();
        List<Object[]> rows = jdbc.query("SELECT id, nickname, password_hash FROM members WHERE username = ?",
                (rs, index) -> new Object[]{rs.getString("id"), rs.getString("nickname"), rs.getString("password_hash")}, normalized);
        if (rows.isEmpty()) { passwords.matches(supplied, "$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5XkqSvL1QcC3rT0MCbXmzmkO8hCdK"); return Optional.empty(); }
        Object[] row = rows.getFirst();
        return passwords.matches(supplied, (String) row[2]) ? Optional.of(new Member((String) row[0], normalized, (String) row[1])) : Optional.empty();
    }

    @Transactional(readOnly = true)
    public Optional<Member> find(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        return jdbc.query("SELECT id, username, nickname FROM members WHERE id = ?", (rs, index) -> new Member(rs.getString("id"), rs.getString("username"), rs.getString("nickname")), id)
                .stream().findFirst();
    }

    private static String nickname(String raw) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() < 2 || value.length() > 12) throw invalid("닉네임은 2~12자로 입력해 주세요.");
        if (value.codePoints().anyMatch(code -> Character.isISOControl(code) || Character.isWhitespace(code) || code == '(' || code == ')')) throw invalid("닉네임에는 공백과 괄호를 쓸 수 없어요.");
        if (value.matches("(?i)(ㅇㅇ|익명|관리자|admin|운영자).*")) throw invalid("사용할 수 없는 닉네임이에요.");
        return value;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }

    public record RegisterInput(String username, String password, String nickname) {}
    public record Member(String id, String username, String nickname) {}
}
