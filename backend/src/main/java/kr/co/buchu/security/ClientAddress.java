package kr.co.buchu.security;

import jakarta.servlet.http.HttpServletRequest;

/** The visitor's address as seen through the Next.js proxy, and the short DC-style hint shown next to anonymous posts. */
public final class ClientAddress {
    private ClientAddress() {}

    public static String of(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].strip();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return request.getRemoteAddr() == null ? "" : request.getRemoteAddr();
    }

    /** "118.235.12.34" → "118.235"; "2001:db8::1" → "2001:db8"; loopback → "127.0". */
    public static String hint(String address) {
        if (address == null || address.isBlank()) return "0.0";
        String value = address.strip();
        if (value.startsWith("[")) value = value.substring(1, Math.max(1, value.indexOf(']') < 0 ? value.length() : value.indexOf(']')));
        if (value.equals("::1") || value.equals("0:0:0:0:0:0:0:1") || value.startsWith("127.")) return "127.0";
        if (value.startsWith("::ffff:")) value = value.substring(7);
        if (value.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            String[] parts = value.split("\\.");
            return parts[0] + "." + parts[1];
        }
        if (value.contains(":")) {
            String[] groups = value.split(":");
            String first = groups.length > 0 && !groups[0].isEmpty() ? groups[0] : "0";
            String second = groups.length > 1 && !groups[1].isEmpty() ? groups[1] : "0";
            return (first + ":" + second).toLowerCase();
        }
        return value.length() > 16 ? value.substring(0, 16) : value;
    }
}
