package kr.co.buchu.commerce;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class TossPaymentProviderTest {
    private PaymentProperties properties;
    private MockRestServiceServer server;
    private TossPaymentProvider provider;

    @BeforeEach void setup() {
        properties = new PaymentProperties(); properties.setEnabled(true);
        properties.setClientKey("test_gck_unit_only"); properties.setSecretKey("test_sk_unit_only");
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.tosspayments.com");
        server = MockRestServiceServer.bindTo(builder).build();
        provider = new TossPaymentProvider(properties, builder.build());
    }

    @Test void confirmsWithServerCredentialsAndStableIdempotencyKey() {
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/confirm")).andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Basic " + Base64.getEncoder().encodeToString("test_sk_unit_only:".getBytes(StandardCharsets.UTF_8))))
                .andExpect(header("Idempotency-Key", "course-confirm-order-id"))
                .andExpect(content().json("{\"paymentKey\":\"payment-key\",\"orderId\":\"order-id\",\"amount\":39000}"))
                .andRespond(withSuccess(payment("DONE", 39000), MediaType.APPLICATION_JSON));
        PaymentProvider.Payment payment = provider.confirm("order-id", "payment-key", 39000);
        assertThat(payment.status()).isEqualTo("DONE");
        assertThat(payment.totalAmount()).isEqualTo(39000);
        assertThat(payment.approvedAt()).isNotNull();
        server.verify();
    }

    @Test void recoversAlreadyApprovedOrderAfterUncertainOrDuplicateApproval() {
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/confirm"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON).body("{\"code\":\"ALREADY_PROCESSED_PAYMENT\"}"));
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/orders/order-id")).andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(payment("DONE", 39000), MediaType.APPLICATION_JSON));
        assertThat(provider.confirm("order-id", "payment-key", 39000).status()).isEqualTo("DONE");
        server.verify();
    }

    @Test void providerFailureDoesNotLeakProviderBodyAndNeverReturnsPendingAsSuccess() {
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/confirm"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("sensitive provider body"));
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/orders/order-id"))
                .andRespond(withSuccess(payment("IN_PROGRESS", 39000), MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> provider.confirm("order-id", "payment-key", 39000))
                .isInstanceOf(PaymentProvider.Unavailable.class).hasMessage("Payment provider temporarily unavailable");
        server.verify();
    }

    @Test void uncertainFullRefundIsReconciledByOrderId() {
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/payment-key/cancel"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("Idempotency-Key", "course-cancel-order-id"))
                .andExpect(content().json("{\"cancelReason\":\"customer request\"}"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST));
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/orders/order-id"))
                .andRespond(withSuccess(payment("CANCELED", 0), MediaType.APPLICATION_JSON));
        assertThat(provider.cancel("order-id", "payment-key", "customer request").status()).isEqualTo("CANCELED");
        server.verify();
    }

    @Test void disabledOrMissingCredentialsNeverCallProvider() {
        properties.setEnabled(false);
        assertThatThrownBy(() -> provider.confirm("order-id", "payment-key", 39000)).isInstanceOf(PaymentProvider.Unavailable.class);
        properties.setEnabled(true); properties.setSecretKey("");
        assertThatThrownBy(() -> provider.cancel("order-id", "payment-key", "customer request")).isInstanceOf(PaymentProvider.Unavailable.class);
        server.verify();
    }

    @Test void lookupUsesServerCredentialsEvenWhenNewPurchasesAreDisabled() {
        properties.setEnabled(false);
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/orders/order-id")).andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Basic " + Base64.getEncoder().encodeToString("test_sk_unit_only:".getBytes(StandardCharsets.UTF_8))))
                .andRespond(withSuccess(payment("CANCELED", 0), MediaType.APPLICATION_JSON));
        assertThat(provider.lookup("order-id").status()).isEqualTo("CANCELED");
        server.verify();
    }
    @Test void cancellationUsesExistingSecretWhenNewSalesAreDisabled() {
        properties.setEnabled(false); properties.setClientKey("");
        server.expect(requestTo("https://api.tosspayments.com/v1/payments/payment-key/cancel")).andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Basic " + Base64.getEncoder().encodeToString("test_sk_unit_only:".getBytes(StandardCharsets.UTF_8))))
                .andRespond(withSuccess(payment("CANCELED", 0), MediaType.APPLICATION_JSON));
        assertThat(provider.cancel("order-id", "payment-key", "customer request").status()).isEqualTo("CANCELED");
        server.verify();
    }
    private static String payment(String status, int balance) {
        return """
                {"paymentKey":"payment-key","orderId":"order-id","currency":"KRW","status":"%s",
                 "totalAmount":39000,"balanceAmount":%d,"approvedAt":"2026-10-15T10:30:00+09:00",
                 "unknownProviderField":"forward-compatible"}
                """.formatted(status, balance);
    }
}
