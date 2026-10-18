"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/submissions";
import { adStatusLabels, krw, adMonthlyPrice, type AdStatus, type Advertisement, type AdminAdPage } from "@/lib/ads";
import { Icon } from "./icons";

const pageSize = 20;
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(parsed); }

export function AdminAds({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [status, setStatus] = useState<AdStatus | "ALL">("PENDING");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<AdminAdPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [intent, setIntent] = useState<{ id: string; action: "approve" | "reject" | "end" } | null>(null);
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setIntent(null);
    api<AdminAdPage>(`/api/admin/ads?status=${status}&page=${page}&size=${pageSize}`, { signal: controller.signal }).then(setList).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "광고 신청을 불러오지 못했습니다.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, revision, onSessionExpired]);

  async function decide() {
    if (!intent || busy) return;
    setBusy(true); setError("");
    try {
      const body = intent.action === "approve" ? { months, note: note.trim() } : intent.action === "reject" ? { note: note.trim() } : undefined;
      const result = await api<Advertisement>(`/api/admin/ads/${encodeURIComponent(intent.id)}/${intent.action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setFeedback(`${result.siteName} 광고를 ${intent.action === "approve" ? "승인해 게재를 시작했습니다" : intent.action === "reject" ? "거절했습니다" : "종료했습니다"}.`);
      setIntent(null); setNote(""); setMonths(1);
      setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally { setBusy(false); }
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / pageSize)) : 1;
  return <div className="admin-ads">
    <div className="admin-metrics">
      <button className={`admin-metric ${status === "PENDING" ? "active" : ""}`} onClick={() => { setStatus("PENDING"); setPage(0); }}><span>입금·승인 대기</span><strong>{list?.pending ?? 0}<small>건</small></strong><Icon name="book" size={22} /></button>
      <button className={`admin-metric ${status === "APPROVED" ? "active" : ""}`} onClick={() => { setStatus("APPROVED"); setPage(0); }}><span>게재 중</span><strong>{list?.active ?? 0}<small>/ {list?.totalSlots ?? 10}자리</small></strong><Icon name="check" size={22} /></button>
      <div className="admin-metric"><span>월 광고비</span><strong>{krw(adMonthlyPrice)}</strong></div>
    </div>
    {feedback && <div className="admin-feedback" role="status"><Icon name="check" size={17} />{feedback}<button aria-label="알림 닫기" onClick={() => setFeedback("")}><Icon name="close" size={16} /></button></div>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <section className="admin-list-panel" aria-label="광고 신청 목록">
      <div className="admin-list-toolbar"><div className="admin-status-tabs">{(["ALL", "PENDING", "APPROVED", "ENDED", "REJECTED"] as const).map(value => <button key={value} className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); }}>{value === "ALL" ? "전체" : adStatusLabels[value]}</button>)}</div><button className="admin-refresh" onClick={() => setRevision(value => value + 1)} disabled={loading}>새로고침</button></div>
      <div className="admin-result-count" role="status">{loading ? "광고 신청을 불러오고 있어요…" : `총 ${list?.total ?? 0}건`}</div>
      {!loading && list && list.items.length === 0 ? <div className="admin-empty"><Icon name="info" size={32} /><h2>해당하는 광고 신청이 없어요</h2><p>양옆 스폰서 자리의 + 타일로 신청이 들어오면 여기에 표시됩니다.</p></div>
        : <ul className="admin-ad-list">{list?.items.map(ad => <li key={ad.id} className="admin-ad-row">
          <span className="ad-tile admin-ad-tile" style={{ "--tile-color": ad.color } as React.CSSProperties}><span><span className="ad-tile-mark" aria-hidden="true">{ad.siteName.slice(0, 2)}</span><strong>{ad.siteName}</strong><p>{ad.tagline}</p></span></span>
          <div className="admin-ad-info">
            <div><span className={`review-badge review-${ad.status === "APPROVED" ? "approved" : ad.status === "REJECTED" ? "rejected" : "pending"}`}>{adStatusLabels[ad.status]}</span><time>{date(ad.createdAt)} 신청</time></div>
            <a href={ad.url} target="_blank" rel="noopener noreferrer">{ad.url} ↗</a>
            <p>{ad.contactEmail}{ad.startsAt && <> · 게재 {date(ad.startsAt)} ~ {date(ad.endsAt)}</>}</p>
            {ad.note && <p className="admin-ad-note">메모: {ad.note}</p>}
            {intent?.id === ad.id ? <form className="admin-ad-decision" onSubmit={event => { event.preventDefault(); void decide(); }}>
              {intent.action === "approve" && <label>게재 기간 <select value={months} onChange={event => setMonths(Number(event.target.value))} disabled={busy}>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}개월 · {krw(adMonthlyPrice * value)}</option>)}</select></label>}
              {intent.action !== "end" && <input value={note} onChange={event => setNote(event.target.value)} placeholder={intent.action === "approve" ? "메모 (예: 10/18 입금 확인)" : "거절 사유 (신청자에게 전달)"} maxLength={500} required={intent.action === "reject"} disabled={busy} />}
              <div><button type="button" className="button button-outline" disabled={busy} onClick={() => setIntent(null)}>취소</button><button type="submit" className={`button ${intent.action === "reject" ? "button-reject" : "button-green"}`} disabled={busy}>{busy ? "처리 중…" : intent.action === "approve" ? "입금 확인·게재 시작" : intent.action === "reject" ? "거절 확정" : "게재 종료"}</button></div>
            </form> : <div className="admin-ad-actions">
              {ad.status === "PENDING" && <><button className="button button-green" onClick={() => { setIntent({ id: ad.id, action: "approve" }); setNote(""); }}>승인</button><button className="button button-outline" onClick={() => { setIntent({ id: ad.id, action: "reject" }); setNote(""); }}>거절</button></>}
              {ad.status === "APPROVED" && <button className="button button-outline" onClick={() => setIntent({ id: ad.id, action: "end" })}>게재 종료</button>}
            </div>}
          </div>
        </li>)}</ul>}
      {pages > 1 && <div className="admin-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {pages}</span><button disabled={page + 1 >= pages || loading} onClick={() => setPage(value => value + 1)}>다음</button></div>}
    </section>
  </div>;
}
