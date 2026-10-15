package kr.co.buchu.commerce;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

@Component
public class TossPaymentProvider implements PaymentProvider {
    private final PaymentProperties properties;
    private final RestClient client;
    private final RestClient queryClient;

    @Autowired
    public TossPaymentProvider(PaymentProperties properties) {
        this.properties = properties;
        this.client = clientWithTimeout(15);
        this.queryClient = clientWithTimeout(6);
    }

    private static RestClient clientWithTimeout(int readSeconds) {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(readSeconds));
        return RestClient.builder().baseUrl("https://api.tosspayments.com")
                .requestFactory(factory).build();
    }

    TossPaymentProvider(PaymentProperties properties, RestClient client) {
        this.properties = properties; this.client = client; this.queryClient = client;
    }

    @Override
    public Payment confirm(String orderId, String paymentKey, int amount) {
        requireEnabled();
        try {
            Payment result = client.post().uri("/v1/payments/confirm")
                    .headers(headers -> headers.setBasicAuth(properties.getSecretKey(), ""))
                    .header("Idempotency-Key", "course-confirm-" + orderId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("paymentKey", paymentKey, "orderId", orderId, "amount", amount))
                    .retrieve().body(Payment.class);
            if (result != null) return result;
        } catch (RestClientException ignored) {
            // A timed-out approval may have succeeded. Verify the provider's order before retrying.
            // Provider exceptions can contain payment data, so never log or expose them.
        }
        Payment recovered = lookup(orderId);
        if (recovered != null && "DONE".equals(recovered.status())) return recovered;
        throw new Unavailable();
    }

    @Override
    public Payment cancel(String orderId, String paymentKey, String reason) {
        if (properties.getSecretKey().isBlank()) throw new Unavailable();
        try {
            Payment result = client.post().uri("/v1/payments/{paymentKey}/cancel", paymentKey)
                    .headers(headers -> headers.setBasicAuth(properties.getSecretKey(), ""))
                    .header("Idempotency-Key", "course-cancel-" + orderId)
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("cancelReason", reason))
                    .retrieve().body(Payment.class);
            if (result != null) return result;
        } catch (RestClientException ignored) {
            // Reconcile an uncertain full refund using the stable order identifier.
        }
        Payment recovered = lookup(orderId);
        if (recovered != null && "CANCELED".equals(recovered.status())) return recovered;
        throw new Unavailable();
    }

    @Override
    public Payment lookup(String orderId) {
        // Disabling new sales must not disable verification/refund reconciliation for existing buyers.
        if (properties.getSecretKey().isBlank()) throw new Unavailable();
        try {
            Payment result = queryClient.get().uri("/v1/payments/orders/{orderId}", orderId)
                    .headers(headers -> headers.setBasicAuth(properties.getSecretKey(), ""))
                    .retrieve().body(Payment.class);
            if (result == null) throw new Unavailable();
            return result;
        } catch (RestClientException ignored) {
            throw new Unavailable();
        }
    }

    private void requireEnabled() { if (!properties.ready()) throw new Unavailable(); }
}
