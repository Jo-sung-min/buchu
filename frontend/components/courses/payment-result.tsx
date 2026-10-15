"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/submissions";
import { getCourseOrderCredentials, orderHeaders, saveCourseOrder } from "@/lib/course-access";
import { won, type CourseOrder, type OrderCredentials } from "@/lib/courses";
import { Icon } from "../icons";

export function PaymentResult({ orderId, paymentKey, amount }: { orderId: string; paymentKey: string; amount: string }) {
  const [order, setOrder] = useState<CourseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const started = useRef(false);
  const running = useRef(false);
  const credentials = useRef<OrderCredentials | null>(null);
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId);
  async function confirm(access: OrderCredentials) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(""); setNeedsCode(false);
    try {
      const existing = await api<CourseOrder>(`/api/course-orders/${orderId}`, { headers: orderHeaders(access) });
      if (existing.status === "CANCELED") throw new Error("취소된 주문입니다. 내 강의실에서 주문 상태를 확인해 주세요.");
      let verified = existing;
      if (existing.status !== "PAID") {
        if (!/^[1-9]\d{0,7}$/.test(amount) || !/^[A-Za-z0-9_=-]{1,200}$/.test(paymentKey) || Number(amount) !== existing.amount) throw new Error("결제 확인 정보가 올바르지 않아요. 주문 번호를 보관하고 수강 문의로 연락해 주세요.");
        verified = await api<CourseOrder>(`/api/course-orders/${orderId}/confirm`, { method: "POST", headers: orderHeaders(access), body: JSON.stringify({ paymentKey, amount: Number(amount) }) });
      }
      if (verified.status !== "PAID") throw new Error("결제 완료를 확인하지 못했어요. 같은 주문으로 다시 확인해 주세요.");
      setOrder(verified);
      try { saveCourseOrder(access); } catch (e) { setError(e instanceof Error ? e.message : "이 기기에 주문을 저장하지 못했어요. 복구 코드를 보관해주세요."); }
      window.history.replaceState(null, "", `/payments/success?orderId=${encodeURIComponent(orderId)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "결제 결과를 확인하지 못했어요. 다시 확인해 주세요."); }
    finally { setBusy(false); running.current = false; }
  }
  useEffect(() => {
    if (started.current) return; started.current = true;
    if (!validId) { setError("주문 정보를 찾을 수 없어요. 내 강의실에서 주문을 확인해 주세요."); return; }
    const saved = getCourseOrderCredentials(orderId);
    if (!saved) { setNeedsCode(true); return; }
    credentials.current = saved; void confirm(saved);
    // A redirect is confirmed once; a deliberate retry reuses the same order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function restore(event: FormEvent) {
    event.preventDefault(); const value = code.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) { setError("복구 코드 형식을 확인해 주세요."); return; }
    credentials.current = { id: orderId, accessToken: value }; void confirm(credentials.current);
  }
  return <div className="container course-payment-result"><span className="section-kicker">BUCHU CLASS</span>{order ? <><Icon name="check" size={42} /><h1>나의 부업 공부, 이제 시작해요</h1><p>결제가 확인되어 강의실을 열었어요.</p><section className="course-checkout-card"><h2>{order.courseTitle}</h2><p>{won(order.amount)} · 강의별 개별 구매</p>{order.expiresAt && <p>{new Date(order.expiresAt).toLocaleDateString("ko-KR")}까지 수강할 수 있어요.</p>}<small>주문 번호 {order.id}</small></section>{error && <p className="course-error" role="alert">{error}</p>}<Link href={`/classroom/${order.id}`} className="button button-green">첫 수업 시작하기 <Icon name="arrow" size={16} /></Link></> : <><h1>{busy ? "결제를 확인하고 있어요" : needsCode ? "수강 복구 코드를 입력해주세요" : "결제 결과를 확인해주세요"}</h1><p>{busy ? "확인이 끝나면 내 강의실을 열어드릴게요." : "결제 완료는 서버에서 확인한 뒤 반영됩니다. 확인이 늦어져도 새 주문을 만들지 말고 같은 주문으로 다시 확인해 주세요."}</p>{validId && <p className="course-access-code">주문 번호 <code>{orderId}</code></p>}{error && <p className="course-error" role="alert">{error}</p>}{needsCode && <form className="course-checkout-card" onSubmit={restore}><label className="course-checkout-fields">구매 전에 보관한 복구 코드<input aria-label="수강 복구 코드" required autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} maxLength={43} /></label><button className="button button-green" disabled={busy}>코드로 결제 확인</button></form>}{!busy && credentials.current && <button className="button button-green" onClick={() => void confirm(credentials.current!)}>같은 주문으로 다시 확인</button>}{!busy && !needsCode && validId && <button className="button button-outline" onClick={() => { setNeedsCode(true); setError(""); }}>다른 복구 코드로 확인</button>}</>}<Link href="/classroom" className="course-classroom-link">내 강의실로 돌아가기</Link></div>;
}
