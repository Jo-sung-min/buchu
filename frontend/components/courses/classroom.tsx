"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { api } from "@/lib/submissions";
import { COURSE_ORDERS_CHANGED_EVENT, COURSE_ORDERS_STORAGE_KEY, getSavedCourseOrders, orderHeaders, saveCourseOrder } from "@/lib/course-access";
import { won, type CourseOrder, type OrderCredentials } from "@/lib/courses";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "주문을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."; }
export function courseDate(value: string | null) {
  if (!value) return "확인 중";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 중";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
}
export function courseOrderExpired(order: CourseOrder, now = Date.now()) {
  const deadline = order.expiresAt ? new Date(order.expiresAt).getTime() : Number.NaN;
  return order.status === "PAID" && (!Number.isFinite(deadline) || deadline <= now);
}

export function CourseOrderRestore({ initialOrderId = "", onRestored, open = false }: { initialOrderId?: string; onRestored?: (order: CourseOrder) => void; open?: boolean }) {
  const [id, setId] = useState(initialOrderId);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState("");

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setRestored("");
    const credentials: OrderCredentials = { id: id.trim(), accessToken: token.trim() };
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credentials.id) || !/^[A-Za-z0-9_-]{43}$/.test(credentials.accessToken)) {
        throw new Error("구매할 때 받은 주문 번호와 복구 코드를 정확히 입력해 주세요.");
      }
      const order = await api<CourseOrder>(`/api/course-orders/${encodeURIComponent(credentials.id)}`, { headers: orderHeaders(credentials) });
      saveCourseOrder(credentials);
      setToken(""); setRestored(`${order.courseTitle} 주문을 이 브라우저에 연결했어요.`);
      onRestored?.(order);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <details className="classroom-restore" open={open || undefined}>
    <summary>다른 기기에서 구매한 강의 불러오기</summary>
    <p>구매할 때 보관한 주문 번호와 복구 코드를 입력해 주세요. 이메일만으로는 주문을 불러올 수 없어요.</p>
    <form onSubmit={restore}>
      <label>주문 번호<input value={id} onChange={(event) => setId(event.target.value)} maxLength={36} required autoComplete="off" spellCheck={false} placeholder="구매할 때 받은 주문 번호" disabled={busy} /></label>
      <label>복구 코드<input type="password" value={token} onChange={(event) => setToken(event.target.value)} maxLength={43} required autoComplete="off" spellCheck={false} placeholder="보관한 복구 코드" disabled={busy} /></label>
      <button className="button button-green" type="submit" disabled={busy}>{busy ? "확인 중…" : "강의 불러오기"}</button>
    </form>
    {error && <p className="course-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
    {restored && <p role="status">{restored}</p>}
  </details>;
}

type LoadedOrder = { credentials: OrderCredentials; order?: CourseOrder; error?: string };

export function Classroom() {
  const [items, setItems] = useState<LoadedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const storage = (event: StorageEvent) => { if (event.key === COURSE_ORDERS_STORAGE_KEY || event.key === null) refresh(); };
    window.addEventListener(COURSE_ORDERS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", storage);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.removeEventListener(COURSE_ORDERS_CHANGED_EVENT, refresh); window.removeEventListener("storage", storage); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const saved = getSavedCourseOrders();
    setLoading(true);
    async function load() {
      const loaded = await Promise.all(saved.map(async (credentials): Promise<LoadedOrder> => {
        try {
          const order = await api<CourseOrder>(`/api/course-orders/${encodeURIComponent(credentials.id)}`, { headers: orderHeaders(credentials), signal: controller.signal });
          return { credentials, order };
        } catch (reason) { return { credentials, error: errorMessage(reason) }; }
      }));
      if (active) { setItems(loaded); setLoading(false); setNow(Date.now()); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [revision]);

  return <div className="classroom-page container">
    <div className="classroom-heading"><div><h1>내 강의실</h1></div><Link className="button button-outline" href="/courses">부업 강의 둘러보기 <Icon name="arrow" size={15} /></Link></div>
    <p className="course-prelaunch-note"><Icon name="info" size={16} />이 브라우저에 연결한 주문이 표시됩니다. 다른 기기에서는 주문 번호와 복구 코드로 불러올 수 있어요.</p>
    {loading ? <div className="course-loading" role="status">내 강의를 불러오고 있어요…</div> : items.length === 0 ? <div className="course-empty"><Icon name="book" size={30} /><h2>아직 연결된 강의가 없어요</h2><p>부업 강의를 구매하면 이곳에서 수강할 수 있어요.<br />이미 구매했다면 아래에서 주문을 불러와 주세요.</p><Link className="button button-green" href="/courses">나에게 맞는 강의 찾기</Link></div> : <div className="classroom-list">
      {items.map(({ credentials, order, error }) => {
        if (!order) return <article className="classroom-order" key={credentials.id}><div><span className="course-order-state">주문 확인 필요</span><h2>주문을 불러오지 못했어요</h2><p>주문 번호 · {credentials.id}</p><p className="course-error" role="alert">{error}</p></div><button className="button button-outline" onClick={() => setRevision((value) => value + 1)}>다시 확인</button></article>;
        const expired = courseOrderExpired(order, now);
        const playable = order.status === "PAID" && !expired;
        const label = order.status === "PENDING" ? "결제 대기" : order.status === "CANCELED" ? "취소된 주문" : expired ? "수강 기간 종료" : "수강 중";
        return <article className="classroom-order" key={credentials.id}>
          <div><span className="course-order-state">{label}</span><h2>{order.courseTitle}</h2><p>주문일 {courseDate(order.createdAt)} · {won(order.amount)}</p>
            {order.status === "PAID" && <p>수강 기한 {courseDate(order.expiresAt)} · 완료한 수업 {order.completedLessonIds.length}개</p>}
            {order.status === "PENDING" && <p>결제가 완료되면 수강할 수 있어요.</p>}
            {order.status === "CANCELED" && <p>취소된 주문은 수강할 수 없어요.</p>}
          </div>
          {playable ? <Link className="button button-green" href={`/classroom/${encodeURIComponent(order.id)}`}>이어서 학습하기 <Icon name="arrow" size={15} /></Link> : order.status === "PENDING" ? <Link className="button button-outline" href={`/courses/${encodeURIComponent(order.courseSlug)}/checkout?orderId=${encodeURIComponent(order.id)}`}>결제 이어하기</Link> : <Link className="button button-outline" href="/courses">다른 강의 둘러보기</Link>}
        </article>;
      })}
    </div>}
    <CourseOrderRestore />
  </div>;
}
