package kr.co.buchu.commerce;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;

/** Only the server talks to a payment provider; no payment credentials enter public responses. */
public interface PaymentProvider {
    Payment confirm(String orderId, String paymentKey, int amount);
    Payment lookup(String orderId);
    Payment cancel(String orderId, String paymentKey, String reason);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Payment(String paymentKey, String orderId, String currency, String status,
                   long totalAmount, long balanceAmount, OffsetDateTime approvedAt) {}

    final class Unavailable extends RuntimeException {
        public Unavailable() { super("Payment provider temporarily unavailable"); }
    }
}
