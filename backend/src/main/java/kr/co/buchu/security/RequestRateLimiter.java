package kr.co.buchu.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@Component
public class RequestRateLimiter {
    private record Window(long started, int count) {}
    private final Map<String, Window> windows = new HashMap<>();

    public synchronized void check(String group, String address, int limit, long durationMillis) {
        long now = System.currentTimeMillis();
        String key = group + ":" + address;
        if (windows.size() > 4096) windows.entrySet().removeIf(entry -> now - entry.getValue().started > 3_600_000);
        if (windows.size() > 8192 && !windows.containsKey(key)) throw limited();
        Window previous = windows.get(key);
        if (previous == null || now - previous.started >= durationMillis) {
            windows.put(key, new Window(now, 1));
        } else {
            if (previous.count >= limit) throw limited();
            windows.put(key, new Window(previous.started, previous.count + 1));
        }
    }

    private static ResponseStatusException limited() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많습니다. 잠시 후 다시 시도해 주세요.");
    }
}
