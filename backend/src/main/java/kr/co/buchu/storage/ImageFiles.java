package kr.co.buchu.storage;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class ImageFiles {
    static final long MAX_SIZE = 8 * 1024 * 1024;
    static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private ImageFiles() {}

    static void validateSignature(String contentType, byte[] bytes) {
        boolean valid = switch (contentType) {
            case "image/png" -> bytes.length >= 8 && Arrays.equals(Arrays.copyOf(bytes, 8),
                    new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10});
            case "image/jpeg" -> bytes.length >= 3 && bytes[0] == (byte) 255
                    && bytes[1] == (byte) 216 && bytes[2] == (byte) 255;
            case "image/webp" -> bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I'
                    && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W'
                    && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
            default -> false;
        };
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 내용이 선택한 이미지 형식과 일치하지 않습니다.");
        }
    }

    static byte[] readLimited(InputStream input, long expectedSize) throws IOException {
        byte[] bytes = input.readNBytes((int) Math.min(expectedSize, MAX_SIZE) + 1);
        if (bytes.length > MAX_SIZE || bytes.length > expectedSize) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "이미지는 최대 8MB이며 신청한 파일 크기와 일치해야 합니다.");
        }
        if (bytes.length != expectedSize) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드한 파일 크기가 신청한 크기와 다릅니다.");
        }
        return bytes;
    }
}
