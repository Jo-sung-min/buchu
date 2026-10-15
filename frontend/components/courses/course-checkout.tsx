"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/submissions";
import { getCourseOrderCredentials, orderHeaders, saveCourseOrder } from "@/lib/course-access";
import { courseLessonCount, won, type Course, type CourseOrder, type OrderCredentials, type PaymentConfig } from "@/lib/courses";
import { CourseCover } from "./course-cover";
import { Icon } from "../icons";

type WidgetPart = { destroy(): Promise<void> | void };
type PaymentMethods = WidgetPart & { getSelectedPaymentMethod(): { code: string } };
type Widgets = {
  setAmount(amount: { currency: "KRW"; value: number }): Promise<void>;
  renderPaymentMethods(options: { selector: string; variantKey: string }): Promise<PaymentMethods>;
  renderAgreement(options: { selector: string; variantKey: string }): Promise<WidgetPart>;
  requestPayment(options: { orderId: string; orderName: string; successUrl: string; failUrl: string; customerEmail?: string; customerName: string }): Promise<void>;
};
type TossFactory = ((key: string) => { widgets(options: { customerKey: string }): Widgets }) & { ANONYMOUS: string };
declare global { interface Window { TossPayments?: TossFactory } }

function PaymentWidget({ config, order, credentials }: { config: PaymentConfig; order: CourseOrder; credentials: OrderCredentials }) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const widgets = useRef<Widgets | null>(null);
  const methods = useRef<PaymentMethods | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!loaded || !window.TossPayments) return;
    let disposed = false;
    let paymentPart: PaymentMethods | undefined;
    let agreementPart: WidgetPart | undefined;
    const destroy = async () => { await paymentPart?.destroy(); await agreementPart?.destroy(); };
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (disposed || !window.TossPayments) return;
      try {
        const instance = window.TossPayments(config.clientKey).widgets({ customerKey: window.TossPayments.ANONYMOUS });
        await instance.setAmount({ currency: "KRW", value: order.amount });
        if (disposed) return;
        paymentPart = await instance.renderPaymentMethods({ selector: "#buchu-payment-methods", variantKey: "DEFAULT" });
        if (disposed) { await destroy(); return; }
        agreementPart = await instance.renderAgreement({ selector: "#buchu-payment-agreement", variantKey: "AGREEMENT" });
        if (disposed) { await destroy(); return; }
        methods.current = paymentPart; widgets.current = instance; setReady(true);
      } catch { if (!disposed) setError("결제 수단을 불러오지 못했어요. 페이지를 다시 열고 같은 주문으로 이어서 진행해 주세요."); }
    });
    return () => { disposed = true; widgets.current = null; methods.current = null; setReady(false); queue.current = queue.current.catch(() => {}).then(destroy); };
  }, [loaded, config.clientKey, order.amount]);
  async function pay() {
    if (!widgets.current || !methods.current || busy) return;
    setError(""); setBusy(true);
    try {
      saveCourseOrder(credentials);
      if (methods.current.getSelectedPaymentMethod().code === "VIRTUAL_ACCOUNT") throw new Error("가상계좌는 아직 지원하지 않아요. 카드나 즉시 결제 수단을 선택해 주세요.");
      await widgets.current.requestPayment({ orderId: order.id, orderName: order.courseTitle.slice(0, 100), ...(order.buyerEmail.length <= 100 ? { customerEmail: order.buyerEmail } : {}), customerName: order.buyerName, successUrl: `${location.origin}/payments/success`, failUrl: `${location.origin}/payments/fail` });
    } catch (e) { setError(e instanceof Error ? e.message : "결제를 진행하지 못했어요. 결제 수단을 확인한 뒤 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <><Script src="https://js.tosspayments.com/v2/standard" onReady={() => setLoaded(true)} onError={() => setError("결제 화면에 연결하지 못했어요. 연결 상태를 확인하고 다시 열어주세요.")} /><div className="toss-payment-surface"><div id="buchu-payment-methods" /><div id="buchu-payment-agreement" /></div>{!ready && !error && <p role="status">안전한 결제 화면을 준비하고 있어요.</p>}{error && <p className="course-error" role="alert">{error}</p>}<button type="button" className="button button-green" disabled={!ready || busy} onClick={() => void pay()}>{busy ? "결제 진행 중…" : `${won(order.amount)} 결제하기`}<Icon name="arrow" size={16} /></button></>;
}

export function CourseCheckout({ course, resumeId = "" }: { course: Course; resumeId?: string }) {
  const [resuming, setResuming] = useState(!!resumeId);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ order: CourseOrder; accessToken: string } | null>(null);
  const [stored, setStored] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [copied, setCopied] = useState(false);
  const creating = useRef(false);
  const canSell = course.status === "PUBLISHED" && !course.isDemo;
  async function loadConfig() { setConfigError(""); try { setConfig(await api<PaymentConfig>("/api/payments/config")); } catch (e) { setConfigError(e instanceof Error ? e.message : "결제 상태를 확인하지 못했어요."); } }
  useEffect(() => { let alive = true; api<PaymentConfig>("/api/payments/config").then(value => { if (alive) setConfig(value); }).catch(e => { if (alive) setConfigError(e.message); }); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!resumeId) return;
    let active = true;
    const saved = getCourseOrderCredentials(resumeId);
    if (!saved) { setError("이 주문의 복구 코드가 없어요. 내 강의실에서 주문을 복구한 뒤 다시 진행해 주세요."); setResuming(false); return; }
    api<CourseOrder>(`/api/course-orders/${resumeId}`, { headers: orderHeaders(saved) }).then(order => {
      if (!active) return;
      if (order.courseId !== course.id || order.status === "CANCELED") throw new Error("이 강의에서 결제를 이어갈 수 없는 주문이에요. 내 강의실에서 상태를 확인해 주세요.");
      setCreated({ order, accessToken: saved.accessToken }); setStored(true);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setResuming(false); });
    return () => { active = false; };
  }, [resumeId, course.id]);
  async function createOrder(event: FormEvent) {
    event.preventDefault(); if (!canSell || !config?.enabled || creating.current) return;
    creating.current = true; setBusy(true); setError("");
    try {
      const result = await api<{ order: CourseOrder; accessToken: string }>("/api/course-orders", { method: "POST", body: JSON.stringify({ courseId: course.id, buyerName, buyerEmail, consent }) });
      setCreated(result);
      saveCourseOrder({ id: result.order.id, accessToken: result.accessToken }); setStored(true);
    } catch (e) { setError(e instanceof Error ? e.message : "주문을 만들지 못했어요."); }
    finally { setBusy(false); creating.current = false; }
  }
  function retrySave() { if (!created) return; try { saveCourseOrder({ id: created.order.id, accessToken: created.accessToken }); setStored(true); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "주문 저장에 실패했어요."); } }
  async function copyBackup() { if (!created) return; try { await navigator.clipboard.writeText(`부추 강의 주문\n주문 번호: ${created.order.id}\n복구 코드: ${created.accessToken}\n내 강의실: ${location.origin}/classroom`); setCopied(true); } catch { setError("복사하지 못했어요. 표시된 주문 번호와 복구 코드를 직접 보관해 주세요."); } }
  return <div className="container course-checkout-page"><Link href={`/courses/${course.slug}`} className="back-link"><Icon name="arrow" size={15} />강의로 돌아가기</Link><h1>강의 구매</h1><div className="course-checkout-layout"><div>
    <section className="course-checkout-card"><h2>{course.title}</h2><p>{course.instructorName} · {course.accessDays}일 수강 · {courseLessonCount(course)}개 수업</p><div className="course-order-total"><span>최종 결제 금액</span><strong>{canSell ? won(created?.order.amount ?? course.price) : "출시 준비 중"}</strong></div></section>
    {!canSell ? <section className="course-checkout-card"><h2>아직 구매할 수 없는 강의예요</h2><p>정식 강의가 준비되면 가격과 함께 판매를 시작합니다.</p><Link href="/courses" className="button button-outline">다른 강의 둘러보기</Link></section> : <>
    {configError ? <section className="course-checkout-card"><p className="course-error" role="alert">{configError}</p><button className="button button-outline" onClick={() => void loadConfig()}>결제 상태 다시 확인</button></section> : !config ? <p role="status">결제 가능 여부를 확인하고 있어요.</p> : !config.enabled ? <section className="course-checkout-card"><h2>결제 서비스를 준비하고 있어요</h2><p>현재는 결제를 받지 않습니다. 강의 소개와 미리보기를 먼저 살펴보세요.</p><Link className="button button-outline" href={`/courses/${course.slug}`}>강의 소개 보기</Link></section> : null}
    {resuming && <p role="status">저장한 주문을 확인하고 있어요.</p>}{resumeId && !created && !resuming && <Link className="button button-outline" href="/classroom">내 강의실에서 주문 확인</Link>}{config?.enabled && !created && !resumeId && <form className="course-checkout-card" onSubmit={event => void createOrder(event)}><h2>구매자 정보</h2><p>회원가입 없이 구매합니다. 수강 복구 코드는 다음 단계에서 꼭 보관해주세요.</p><div className="course-checkout-fields"><label>이름<input required maxLength={80} autoComplete="name" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="구매자 이름" /></label><label>이메일<input required type="email" maxLength={254} autoComplete="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="hello@example.com" /></label></div><details className="course-policy-copy"><summary>구매·환불 및 개인정보 이용 안내</summary><p>주문 확인, 강의 제공과 고객 문의 대응을 위해 이름과 이메일을 사용합니다. 구매에 필요한 정보 제공을 거부할 수 있으나 주문 진행은 어렵습니다.</p><p>강의 제공 기간: 결제 완료일부터 {course.accessDays}일</p><p>{course.refundPolicy}</p><p>문의: {course.supportEmail}</p><p>이메일만으로 수강 권한을 복구할 수 없습니다. 주문 번호와 복구 코드를 안전하게 보관해주세요.</p></details><label className="course-checkout-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>구매·환불 및 개인정보 이용 안내를 확인하고 동의합니다.</span></label><button className="button button-green" disabled={busy || !consent}>{busy ? "주문 준비 중…" : "주문 확인하고 다음으로"}<Icon name="arrow" size={16} /></button></form>}
    {created?.order.status === "PAID" && <section className="course-checkout-card"><h2>이미 구매한 강의예요</h2><Link className="button button-green" href={`/classroom/${created.order.id}`}>내 강의실로 이동</Link></section>}{created?.order.status === "PENDING" && <section className="course-checkout-card"><h2>수강할 수 있는 열쇠를 보관해주세요</h2><p>이 브라우저에 주문을 저장합니다. 다른 기기에서는 아래 주문 번호와 복구 코드로 강의실을 열 수 있어요. 다른 사람과 공유하지 마세요.</p><div className="course-access-code"><span>주문 번호</span><code>{created.order.id}</code><span>복구 코드</span><code>{created.accessToken}</code><button className="button button-outline" type="button" onClick={() => void copyBackup()}>{copied ? "복사했어요" : "주문 번호·복구 코드 복사"}</button></div>{!stored && <button className="button button-outline" onClick={retrySave}>브라우저에 주문 다시 저장</button>}<label className="course-checkout-consent"><input type="checkbox" checked={backedUp} onChange={e => setBackedUp(e.target.checked)} /><span>다른 기기에서도 수강할 수 있도록 복구 코드를 별도로 보관했어요.</span></label>{stored && backedUp && config?.enabled && <PaymentWidget config={config} order={created.order} credentials={{ id: created.order.id, accessToken: created.accessToken }} />}</section>}
    </>}{error && <p className="course-error" role="alert">{error}</p>}
  </div><aside className="course-order-summary"><CourseCover course={course} /><h2>{course.title}</h2><p>{course.instructorName}</p><dl><div><dt>구매 방식</dt><dd>개별 강의 구매</dd></div><div><dt>수강 기간</dt><dd>{course.accessDays}일</dd></div><div><dt>예상 추가 실습비</dt><dd>{won(course.startupCost)}</dd></div></dl><p>강의료 외 실습비는 별도예요. 준비물과 커리큘럼을 구매 전에 확인해주세요.</p></aside></div></div>;
}
