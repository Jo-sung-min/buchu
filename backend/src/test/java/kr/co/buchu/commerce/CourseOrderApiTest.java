package kr.co.buchu.commerce;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import kr.co.buchu.course.CourseModels;
import kr.co.buchu.course.CourseService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:course-commerce-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "buchu.payments.enabled=true", "buchu.payments.client-key=test_gck_unit_only", "buchu.payments.secret-key=test_sk_unit_only"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CourseOrderApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired CourseService courses;
    @Autowired PaymentProperties properties;
    @MockitoBean PaymentProvider provider;
    private String courseId;

    @BeforeEach void setup() throws Exception {
        properties.setEnabled(true);
        when(provider.lookup(anyString())).thenAnswer(call -> approved(call.getArgument(0)));
        courseId = courses.create(mapper.treeToValue(courseInput("PUBLISHED", false), CourseModels.CourseInput.class)).id();
    }
    @AfterEach void restoreConfig() { properties.setEnabled(true); }

    @Test void disabledPaymentsExposeNoSecretAndRejectCreation() throws Exception {
        properties.setEnabled(false);
        String config = mvc.perform(get("/api/payments/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false)).andExpect(jsonPath("$.clientKey").value(""))
                .andReturn().getResponse().getContentAsString();
        assertThat(config).doesNotContain("test_sk", "secret");
        createRequest(orderInput()).andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM course_orders", Integer.class)).isZero();
        verifyNoInteractions(provider);
    }

    @Test void orderUsesCatalogPriceAndStoresOnlyHashedCapability() throws Exception {
        JsonNode created = create();
        String id = id(created), token = token(created);
        assertThat(token).hasSize(43);
        assertThat(created.path("order").path("amount").asInt()).isEqualTo(39000);
        String hash = jdbc.queryForObject("SELECT access_token_hash FROM course_orders WHERE id = ?", String.class, id);
        assertThat(hash).hasSize(64).isNotEqualTo(token);
        String response = mvc.perform(get("/api/course-orders/{id}", id).header("X-Order-Token", token))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(token, hash, "paymentKey");
        createRequest(orderInput().put("amount", 1)).andExpect(status().isBadRequest());
        createRequest(orderInput().put("consent", false)).andExpect(status().isBadRequest());
        createRequest(orderInput().put("consent", "true")).andExpect(status().isBadRequest());
        createRequest(orderInput().put("buyerEmail", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/course-orders").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(orderInput())))
                .andExpect(status().isForbidden());
    }

    @Test void upcomingDemoAndUnpublishedCoursesCannotBePurchased() throws Exception {
        for (String state : List.of("COMING_SOON", "DRAFT", "ARCHIVED")) {
            jdbc.update("UPDATE courses SET status = ? WHERE id = ?", state, courseId);
            createRequest(orderInput()).andExpect(status().isNotFound());
        }
        jdbc.update("UPDATE courses SET status = 'COMING_SOON', is_demo = TRUE WHERE id = ?", courseId);
        createRequest(orderInput()).andExpect(status().isNotFound());
        verifyNoInteractions(provider);
    }

    @Test void capabilityProtectsPrivateOrdersAndUnpaidLessons() throws Exception {
        JsonNode first = create(), second = create();
        mvc.perform(get("/api/course-orders/{id}", id(first))).andExpect(status().isNotFound());
        mvc.perform(get("/api/course-orders/{id}", id(first)).header("X-Order-Token", token(second))).andExpect(status().isNotFound());
        lesson(first, "paid-lesson").andExpect(status().isForbidden());
        mvc.perform(post("/api/course-orders/{id}/lessons/paid-lesson/progress", id(first)).with(csrf())
                .header("X-Order-Token", token(first)).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test void amountTamperingCannotReachProvider() throws Exception {
        JsonNode order = create();
        for (JsonNode amount : List.of(mapper.readTree("1"), mapper.readTree("39000.1"), mapper.readTree("\"39000\""), mapper.nullNode())) {
            ObjectNode input = confirmInput(); input.set("amount", amount);
            confirmRequest(order, input).andExpect(status().isBadRequest());
        }
        confirmRequest(order, confirmInput().put("orderId", "another-order")).andExpect(status().isBadRequest());
        confirmRequest(order, confirmInput().put("paymentKey", "bad/key")).andExpect(status().isBadRequest());
        verifyNoInteractions(provider);
        assertPending(order);
    }

    @Test void onlyMatchingCompletedKrwProviderPaymentGrantsAccess() throws Exception {
        JsonNode order = create();
        PaymentProvider.Payment valid = approved(id(order));
        List<PaymentProvider.Payment> invalid = List.of(
                new PaymentProvider.Payment(valid.paymentKey(), "other-order", "KRW", "DONE", 39000, 39000, valid.approvedAt()),
                new PaymentProvider.Payment("other-key", id(order), "KRW", "DONE", 39000, 39000, valid.approvedAt()),
                new PaymentProvider.Payment(valid.paymentKey(), id(order), "USD", "DONE", 39000, 39000, valid.approvedAt()),
                new PaymentProvider.Payment(valid.paymentKey(), id(order), "KRW", "DONE", 1, 1, valid.approvedAt()),
                new PaymentProvider.Payment(valid.paymentKey(), id(order), "KRW", "WAITING_FOR_DEPOSIT", 39000, 39000, valid.approvedAt()),
                new PaymentProvider.Payment(valid.paymentKey(), id(order), "KRW", "DONE", 39000, 100, valid.approvedAt()),
                new PaymentProvider.Payment(valid.paymentKey(), id(order), "KRW", "DONE", 39000, 39000, null));
        for (PaymentProvider.Payment response : invalid) {
            when(provider.confirm(id(order), "test_payment_key", 39000)).thenReturn(response);
            confirmRequest(order, confirmInput()).andExpect(status().isBadGateway());
            assertPending(order);
        }
    }

    @Test void providerFailureNeverMarksPaidAndCanBeRetried() throws Exception {
        JsonNode order = create();
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenThrow(new PaymentProvider.Unavailable()).thenReturn(approved(id(order)));
        confirmRequest(order, confirmInput()).andExpect(status().isServiceUnavailable());
        assertPending(order);
        confirmRequest(order, confirmInput()).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAID"));
    }

    @Test void approvalIsIdempotentAndAccessPeriodUsesPurchaseSnapshot() throws Exception {
        JsonNode order = create();
        ObjectNode changed = courseInput("PUBLISHED", false); changed.put("price", 99000).put("accessDays", 365);
        courses.update(courseId, mapper.treeToValue(changed, CourseModels.CourseInput.class));
        PaymentProvider.Payment payment = approved(id(order));
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenReturn(payment);
        JsonNode paid = mapper.readTree(confirmRequest(order, confirmInput()).andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(39000)).andReturn().getResponse().getContentAsString());
        assertThat(OffsetDateTime.parse(paid.path("expiresAt").asText())).isEqualTo(payment.approvedAt().plusDays(90));
        confirmRequest(order, confirmInput()).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAID"));
        verify(provider, times(1)).confirm(id(order), "test_payment_key", 39000);
        confirmRequest(order, confirmInput().put("paymentKey", "different_key")).andExpect(status().isBadRequest());
        lesson(order, "paid-lesson").andExpect(status().isOk()).andExpect(jsonPath("$.body").value("유료 수업 본문입니다. 첫 실행을 준비하고 결과물을 작성합니다."));
        jdbc.update("UPDATE courses SET status = 'ARCHIVED' WHERE id = ?", courseId);
        lesson(order, "paid-lesson").andExpect(status().isOk());
    }

    @Test void paidCourseMetadataRemainsAvailableAfterArchiveAndDoesNotLeakLessonBodies() throws Exception {
        JsonNode order = create();
        mvc.perform(get("/api/course-orders/{id}/course", id(order)).header("X-Order-Token", token(order))).andExpect(status().isForbidden());
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenReturn(approved(id(order)));
        confirmRequest(order, confirmInput()).andExpect(status().isOk());
        jdbc.update("UPDATE courses SET status = 'ARCHIVED' WHERE id = ?", courseId);
        mvc.perform(get("/api/course-orders/{id}/course", id(order))).andExpect(status().isNotFound());
        String response = mvc.perform(get("/api/course-orders/{id}/course", id(order)).header("X-Order-Token", token(order)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.curriculum[0].lessons[0].id").value("paid-lesson"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("videoUrl", "body", "유료 수업 본문");
        jdbc.update("UPDATE course_orders SET expires_at = ? WHERE id = ?", OffsetDateTime.now(ZoneOffset.UTC).minusDays(1), id(order));
        mvc.perform(get("/api/course-orders/{id}/course", id(order)).header("X-Order-Token", token(order))).andExpect(status().isForbidden());
    }

    @Test void progressIsPrivateAndRevokedOnExpiry() throws Exception {
        JsonNode order = paidOrder();
        progress(order, "paid-lesson", "true").andExpect(status().isOk()).andExpect(jsonPath("$.completedLessonIds[0]").value("paid-lesson"));
        progress(order, "paid-lesson", "true").andExpect(status().isOk()).andExpect(jsonPath("$.completedLessonIds.length()").value(1));
        progress(order, "paid-lesson", "false").andExpect(status().isOk()).andExpect(jsonPath("$.completedLessonIds.length()").value(0));
        progress(order, "not-in-this-course", "true").andExpect(status().isNotFound());
        lesson(order, "not-in-this-course").andExpect(status().isNotFound());
        progress(order, "paid-lesson", "\"true\"").andExpect(status().isBadRequest());
        jdbc.update("UPDATE course_orders SET expires_at = ? WHERE id = ?", OffsetDateTime.now(ZoneOffset.UTC).minusDays(1), id(order));
        lesson(order, "paid-lesson").andExpect(status().isForbidden());
        progress(order, "paid-lesson", "true").andExpect(status().isForbidden());
    }

    @Test void adminRefundRequiresAuthenticationAndVerifiedProviderCancellation() throws Exception {
        JsonNode order = paidOrder();
        mvc.perform(get("/api/admin/course-orders")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/course-orders").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        String list = mvc.perform(get("/api/admin/course-orders").with(user("admin").roles("ADMIN")).param("status", "PAID"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andReturn().getResponse().getContentAsString();
        assertThat(list).doesNotContain(token(order), "test_payment_key");
        mvc.perform(post("/api/admin/course-orders/{id}/cancel", id(order)).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"구매자 요청 환불\"}")).andExpect(status().isForbidden());
        when(provider.cancel(id(order), "test_payment_key", "구매자 요청 환불")).thenThrow(new PaymentProvider.Unavailable());
        cancel(order).andExpect(status().isServiceUnavailable());
        lesson(order, "paid-lesson").andExpect(status().isOk());
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).cancel(id(order), "test_payment_key", "구매자 요청 환불");
        cancel(order).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELED"));
        cancel(order).andExpect(status().isOk());
        lesson(order, "paid-lesson").andExpect(status().isForbidden());
        confirmRequest(order, confirmInput()).andExpect(status().isConflict());
        verify(provider, times(2)).cancel(id(order), "test_payment_key", "구매자 요청 환불");
    }

    @Test void paymentKeyCannotBeReusedAcrossOrders() throws Exception {
        JsonNode first = paidOrder(), second = create();
        confirmRequest(second, confirmInput()).andExpect(status().isBadRequest());
        verify(provider, times(1)).confirm(anyString(), anyString(), anyInt());
        assertPending(second);
        assertThat(first.path("order").path("id").asText()).isNotEqualTo(id(second));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentConfirmationCallsProviderOnlyOnce() throws Exception {
        JsonNode order = create();
        CountDownLatch firstInProvider = new CountDownLatch(1), releaseProvider = new CountDownLatch(1);
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenAnswer(call -> {
            firstInProvider.countDown();
            assertThat(releaseProvider.await(5, TimeUnit.SECONDS)).isTrue();
            return approved(id(order));
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> confirmRequest(order, confirmInput()).andReturn().getResponse().getStatus());
            assertThat(firstInProvider.await(5, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> confirmRequest(order, confirmInput()).andReturn().getResponse().getStatus());
            releaseProvider.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            verify(provider, times(1)).confirm(id(order), "test_payment_key", 39000);
        } finally {
            releaseProvider.countDown();
            jdbc.update("DELETE FROM course_orders WHERE id = ?", id(order));
            jdbc.update("DELETE FROM courses WHERE id = ?", courseId);
        }
    }

    @Test void externalFullAndPartialRefundsBlockEveryLearningEndpointWithoutWebhook() throws Exception {
        JsonNode order = paidOrder();
        for (PaymentProvider.Payment payment : List.of(
                new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)),
                new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "PARTIAL_CANCELED", 39000, 19500, OffsetDateTime.now(ZoneOffset.UTC)))) {
            doReturn(payment).when(provider).lookup(id(order));
            lesson(order, "paid-lesson").andExpect(status().isForbidden());
            progress(order, "paid-lesson", "true").andExpect(status().isForbidden());
            mvc.perform(get("/api/course-orders/{id}/course", id(order)).header("X-Order-Token", token(order))).andExpect(status().isForbidden());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM course_lesson_progress WHERE order_id = ?", Integer.class, id(order))).isZero();
    }

    @Test void paidEntitlementRecheckFailsClosedAndStillWorksWhenNewSalesAreDisabled() throws Exception {
        JsonNode order = paidOrder();
        properties.setEnabled(false);
        lesson(order, "paid-lesson").andExpect(status().isOk());
        doThrow(new PaymentProvider.Unavailable()).when(provider).lookup(id(order));
        lesson(order, "paid-lesson").andExpect(status().isServiceUnavailable());
        doReturn(new PaymentProvider.Payment("foreign-key", id(order), "KRW", "DONE", 39000, 39000, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        lesson(order, "paid-lesson").andExpect(status().isBadGateway());
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "USD", "DONE", 39000, 39000, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        lesson(order, "paid-lesson").andExpect(status().isBadGateway());
    }

    @Test void webhookUsesVerifiedProviderStatusAndFullRefundReplayIsIdempotent() throws Exception {
        JsonNode order = paidOrder();
        // A forged CANCELED payload cannot cancel a provider-confirmed DONE purchase.
        webhook(event(order, "CANCELED")).andExpect(status().isOk()).andExpect(jsonPath("$.received").value(true));
        assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("PAID");
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        // Even a stale/forged DONE hint triggers a fresh server lookup, never a trusted state transition.
        webhook(event(order, "DONE")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("CANCELED");
        webhook(event(order, "CANCELED")).andExpect(status().isOk());
        verify(provider, times(2)).lookup(id(order));
        lesson(order, "paid-lesson").andExpect(status().isForbidden());
    }

    @Test void webhookCannotCreatePaidAccessAndIgnoresUnknownOrMismatchingHints() throws Exception {
        JsonNode order = create();
        webhook(event(order, "DONE")).andExpect(status().isOk());
        assertPending(order);
        verify(provider, never()).lookup(anyString());
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenReturn(approved(id(order)));
        confirmRequest(order, confirmInput()).andExpect(status().isOk());
        ObjectNode foreign = event(order, "CANCELED");
        ((ObjectNode) foreign.path("data")).put("paymentKey", "foreign-key");
        webhook(foreign).andExpect(status().isOk());
        ((ObjectNode) foreign.path("data")).put("orderId", UUID.randomUUID().toString());
        webhook(foreign).andExpect(status().isOk());
        verify(provider, never()).lookup(anyString());
    }

    @Test void webhookProviderFailureIsRetryableAndMismatchesNeverRevokeAccess() throws Exception {
        JsonNode order = paidOrder();
        doThrow(new PaymentProvider.Unavailable()).when(provider).lookup(id(order));
        webhook(event(order, "CANCELED")).andExpect(status().isServiceUnavailable());
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "USD", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        webhook(event(order, "CANCELED")).andExpect(status().isBadGateway());
        assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("PAID");
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "PARTIAL_CANCELED", 39000, 1000, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        webhook(event(order, "CANCELED")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("PAID");
        doReturn(new PaymentProvider.Payment("test_payment_key", id(order), "KRW", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)))
                .when(provider).lookup(id(order));
        webhook(event(order, "CANCELED")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("CANCELED");
    }

    @Test void webhookPayloadIsBoundedAndCsrfExemptionIsExact() throws Exception {
        webhook(mapper.createObjectNode().put("eventType", "UNRELATED_EVENT")).andExpect(status().isOk());
        webhook(mapper.createObjectNode().put("eventType", "PAYMENT_STATUS_CHANGED")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/payments/webhook").servletPath("/api/payments/webhook")
                .contentType(MediaType.APPLICATION_JSON).content("x".repeat(65537))).andExpect(status().isPayloadTooLarge());
        mvc.perform(post("/api/payments/webhook").servletPath("/api/payments/webhook")
                .contentType(MediaType.APPLICATION_JSON).content("{} {}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/payments/webhook/extra").servletPath("/api/payments/webhook/extra")
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        mvc.perform(put("/api/payments/webhook").servletPath("/api/payments/webhook")
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        verify(provider, never()).lookup(anyString());
    }

    private ObjectNode event(JsonNode order, String claimedStatus) {
        ObjectNode result = mapper.createObjectNode().put("eventType", "PAYMENT_STATUS_CHANGED").put("createdAt", "2026-10-15T10:30:00");
        result.putObject("data").put("orderId", id(order)).put("paymentKey", "test_payment_key").put("status", claimedStatus).put("totalAmount", 1);
        return result;
    }
    private ResultActions webhook(ObjectNode event) throws Exception {
        return mvc.perform(post("/api/payments/webhook").servletPath("/api/payments/webhook")
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(event)));
    }
    @Test void administratorCanRefundExistingOrderWhenNewSalesAreDisabled() throws Exception {
        JsonNode order = paidOrder();
        properties.setEnabled(false);
        when(provider.cancel(id(order), "test_payment_key", "구매자 요청 환불")).thenReturn(new PaymentProvider.Payment(
                "test_payment_key", id(order), "KRW", "CANCELED", 39000, 0, OffsetDateTime.now(ZoneOffset.UTC)));
        cancel(order).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELED"));
        lesson(order, "paid-lesson").andExpect(status().isForbidden());
        createRequest(orderInput()).andExpect(status().isServiceUnavailable());
        verify(provider, times(1)).cancel(id(order), "test_payment_key", "구매자 요청 환불");
    }
    private ResultActions cancel(JsonNode order) throws Exception {
        return mvc.perform(post("/api/admin/course-orders/{id}/cancel", id(order)).with(user("admin").roles("ADMIN")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"구매자 요청 환불\"}"));
    }
    private ResultActions lesson(JsonNode order, String lesson) throws Exception {
        return mvc.perform(get("/api/course-orders/{id}/lessons/{lesson}", id(order), lesson).header("X-Order-Token", token(order)));
    }
    private ResultActions progress(JsonNode order, String lesson, String value) throws Exception {
        return mvc.perform(post("/api/course-orders/{id}/lessons/{lesson}/progress", id(order), lesson).with(csrf())
                .header("X-Order-Token", token(order)).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":" + value + "}"));
    }
    private JsonNode create() throws Exception { return mapper.readTree(createRequest(orderInput()).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()); }
    private JsonNode paidOrder() throws Exception {
        JsonNode order = create();
        when(provider.confirm(id(order), "test_payment_key", 39000)).thenReturn(approved(id(order)));
        confirmRequest(order, confirmInput()).andExpect(status().isOk()); return order;
    }
    private PaymentProvider.Payment approved(String id) { return new PaymentProvider.Payment("test_payment_key", id, "KRW", "DONE", 39000, 39000, OffsetDateTime.now(ZoneOffset.UTC).withNano(0)); }
    private ResultActions createRequest(ObjectNode input) throws Exception {
        return mvc.perform(post("/api/course-orders").with(csrf()).with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }
    private ResultActions confirmRequest(JsonNode order, ObjectNode input) throws Exception {
        return mvc.perform(post("/api/course-orders/{id}/confirm", id(order)).with(csrf()).header("X-Order-Token", token(order))
                .with(request -> { request.setRemoteAddr(UUID.randomUUID().toString()); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)));
    }
    private ObjectNode orderInput() { return mapper.createObjectNode().put("courseId", courseId).put("buyerName", "구매자").put("buyerEmail", "buyer@example.com").put("consent", true); }
    private ObjectNode confirmInput() { return mapper.createObjectNode().put("paymentKey", "test_payment_key").put("amount", 39000); }
    private void assertPending(JsonNode order) { assertThat(jdbc.queryForObject("SELECT status FROM course_orders WHERE id = ?", String.class, id(order))).isEqualTo("PENDING"); }
    private String id(JsonNode created) { return created.path("order").path("id").asText(); }
    private String token(JsonNode created) { return created.path("accessToken").asText(); }
    private ObjectNode courseInput(String status, boolean demo) throws Exception {
        return (ObjectNode) mapper.readTree("""
                {"slug":"course-%s","title":"부업 강의 테스트","subtitle":"처음 시작하는 실전 부업 강의",
                 "description":"기초부터 차근차근 배우고 첫 번째 결과물을 완성하는 실전 부업 강의입니다.",
                 "category":"AFFILIATE","level":"BEGINNER","status":"%s","isDemo":%s,
                 "instructorName":"테스트 강사","instructorBio":"직접 부업을 운영하며 얻은 경험을 전달하는 강사입니다.",
                 "thumbnailUrl":"","refundPolicy":"수강 전 전액 환불을 제공합니다. 수강 이후에는 진행률과 제공 기간에 따라 안내합니다.","supportEmail":"support@example.com",
                 "price":39000,"accessDays":90,"weeklyHours":3,"startupCost":0,"outcomes":["첫 게시물 완성"],"requirements":["컴퓨터"],"relatedProgramSlug":null,
                 "curriculum":[{"id":"chapter-one","title":"첫 실행","lessons":[{"id":"paid-lesson","title":"첫 게시물","durationMinutes":20,"preview":false,
                 "body":"유료 수업 본문입니다. 첫 실행을 준비하고 결과물을 작성합니다.","videoUrl":""}]}]}
                """.formatted(UUID.randomUUID(), status, demo));
    }
}
