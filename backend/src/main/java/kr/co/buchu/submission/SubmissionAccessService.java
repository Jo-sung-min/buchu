package kr.co.buchu.submission;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class SubmissionAccessService {
    private final JdbcTemplate jdbc;

    public SubmissionAccessService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public void requireEditable(String id, String token) {
        String status = check(id, token, true);
        if (!status.equals("DRAFT") && !status.equals("REJECTED")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "심사 중이거나 승인된 신청은 수정할 수 없습니다.");
        }
    }

    public void requireOwner(String id, String token) { check(id, token, false); }

    private String check(String id, String token, boolean lock) {
        if (token == null || token.length() < 32 || token.length() > 128) throw notFound();
        var rows = jdbc.query("SELECT access_token_hash, status FROM submissions WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, id);
        if (rows.isEmpty() || !MessageDigest.isEqual(rows.getFirst()[0].getBytes(StandardCharsets.US_ASCII),
                hash(token).getBytes(StandardCharsets.US_ASCII))) throw notFound();
        return rows.getFirst()[1];
    }

    public static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "신청 정보를 찾을 수 없습니다. 저장한 신청 키를 확인해 주세요.");
    }
}
