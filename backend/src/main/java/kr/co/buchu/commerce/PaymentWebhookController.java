package kr.co.buchu.commerce;

import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import kr.co.buchu.security.RequestRateLimiter;

import java.io.IOException;
import java.util.Map;

@RestController
public class PaymentWebhookController {
    private static final int MAX_BYTES = 65_536;
    private final CourseOrderService orders;
    private final RequestRateLimiter limits;
    private final ObjectMapper mapper;

    public PaymentWebhookController(CourseOrderService orders, RequestRateLimiter limits, ObjectMapper mapper) {
        this.orders = orders; this.limits = limits; this.mapper = mapper.copy();
        this.mapper.getFactory().setStreamReadConstraints(StreamReadConstraints.builder()
                .maxNestingDepth(20).maxStringLength(8192).maxNumberLength(128).maxDocumentLength(MAX_BYTES).build());
    }

    @PostMapping(value = "/api/payments/webhook", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Boolean> receive(HttpServletRequest request) throws IOException {
        limits.check("course-payment-webhook", request.getRemoteAddr(), 120, 60_000);
        if (request.getContentLengthLong() > MAX_BYTES) throw tooLarge();
        byte[] body = request.getInputStream().readNBytes(MAX_BYTES + 1);
        if (body.length > MAX_BYTES) throw tooLarge();
        JsonNode event;
        try { event = mapper.readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readValue(body); }
        catch (IOException ignored) { throw invalid(); }
        if (event == null || !event.isObject() || !event.path("eventType").isTextual()) throw invalid();
        if (!"PAYMENT_STATUS_CHANGED".equals(event.path("eventType").textValue())) return Map.of("received", true);
        JsonNode data = event.path("data");
        if (!data.isObject() || !data.path("orderId").isTextual() || !data.path("paymentKey").isTextual()) throw invalid();
        String orderId = data.path("orderId").textValue(), paymentKey = data.path("paymentKey").textValue();
        if (!orderId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                || paymentKey.length() > 200 || !paymentKey.matches("[A-Za-z0-9_=-]+")) throw invalid();
        orders.reconcileWebhook(orderId, paymentKey);
        return Map.of("received", true);
    }

    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "웹훅 형식을 확인해 주세요."); }
    private static ResponseStatusException tooLarge() { return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "웹훅 본문이 너무 큽니다."); }
}
