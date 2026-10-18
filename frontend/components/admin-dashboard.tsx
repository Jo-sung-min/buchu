"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, helpTypeLabels, submissionBoardLabels, type Submission } from "@/lib/submissions";
import { DetailContent, safeContentUrl } from "./detail-content";
import { BuchuMark, Icon } from "./icons";
import { channelLabels } from "@/lib/types";
import { AdminReviews } from "./admin-reviews";
import { AdminPosts } from "./admin-posts";
import { AdminAds } from "./admin-ads";
import { AdminCourses, AdminCourseOrders } from "./admin-courses";

type Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type ReviewEvent = { decision: string; note: string; reviewedAt: string; reviewedBy: string };
type ReviewedSubmission = Submission & { reviewEvents?: ReviewEvent[] };
type SubmissionList = { items: Submission[]; total: number; page: number; size: number; counts: Record<Status, number> };
const statusLabels: Record<Status, string> = { DRAFT: "작성 중", PENDING: "승인 대기", APPROVED: "승인 완료", REJECTED: "거절" };
const emptyCounts = { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요."; }
function Badge({ status }: { status: Status }) { return <span className={`review-badge review-${status.toLowerCase()}`}>{statusLabels[status]}</span>; }

export function AdminDashboard() {
  const [panel, setPanel] = useState<"submissions" | "posts" | "reviews" | "ads" | "courses" | "course-orders">("submissions");
  const [courseDirty, setCourseDirty] = useState(false);
  function selectPanel(next: typeof panel) {
    if (next === panel || (courseDirty && !window.confirm("저장하지 않은 강의 정보가 있습니다. 변경 내용을 닫고 이동할까요?"))) return;
    setPanel(next);
  }
  const expireSession = useCallback(() => { setSession({ authenticated: false }); setError("로그인이 만료되었습니다. 다시 로그인해 주세요."); }, []);
  const [session, setSession] = useState<{ authenticated: boolean; username?: string } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [status, setStatus] = useState<Status | "ALL">("PENDING");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [list, setList] = useState<SubmissionList>({ items: [], total: 0, page: 0, size: 10, counts: emptyCounts });
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewedSubmission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [preview, setPreview] = useState(false);
  const [intent, setIntent] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [note, setNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const checkSession = useCallback(async () => {
    try { setSession(await api<{ authenticated: boolean; username?: string }>("/api/admin/session")); }
    catch (error) { setSession({ authenticated: false }); if (!(error instanceof ApiError && error.status === 401)) setError(errorMessage(error)); }
  }, []);
  useEffect(() => { void checkSession(); }, [checkSession]);
  useEffect(() => {
    if (!session?.authenticated) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ q: search, page: String(page), size: "10" });
    if (status !== "ALL") params.set("status", status);
    else params.set("status", "ALL");
    api<SubmissionList>(`/api/admin/submissions?${params}`, { signal: controller.signal }).then(setList).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) setSession({ authenticated: false });
      setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session?.authenticated, status, page, search, revision]);
  useEffect(() => {
    setSelected(null); setIntent(null); setNote(""); setDetailError("");
    if (!selectedId || !session?.authenticated) return;
    const controller = new AbortController();
    setDetailLoading(true);
    api<ReviewedSubmission>(`/api/admin/submissions/${selectedId}`, { signal: controller.signal }).then(setSelected).catch(error => {
      if (!controller.signal.aborted) setDetailError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision, session?.authenticated]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginBusy(true); setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setPassword(""); await checkSession();
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoginBusy(false); }
  }
  async function logout() {
    if (courseDirty && !window.confirm("저장하지 않은 강의 정보가 있습니다. 로그아웃할까요?")) return;
    try { await api("/api/admin/logout", { method: "POST" }); setSession({ authenticated: false }); setSelected(null); setSelectedId(null); setList({ items: [], total: 0, page: 0, size: 10, counts: emptyCounts }); }
    catch (error) { setError(errorMessage(error)); }
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !intent || reviewBusy) return;
    if (intent === "REJECTED" && !note.trim()) { setDetailError("기업이 수정할 수 있도록 거절 사유를 작성해 주세요."); return; }
    setReviewBusy(true); setDetailError("");
    try {
      await api(`/api/admin/submissions/${selected.id}/review`, { method: "POST", body: JSON.stringify({ decision: intent, note: note.trim() }) });
      setFeedback(intent === "APPROVED" ? "승인했습니다. 공개 부업 목록에 반영되었습니다." : "거절 처리했습니다. 신청자가 사유를 확인하고 다시 신청할 수 있습니다.");
      setIntent(null); setNote(""); setRevision(value => value + 1);
    } catch (error) { setDetailError(errorMessage(error)); }
    finally { setReviewBusy(false); }
  }

  if (session === null) return <div className="admin-loading container" role="status">관리자 세션을 확인하고 있습니다.</div>;
  if (!session.authenticated) return <div className="admin-login-wrap"><section className="admin-login-card"><div className="admin-login-mark"><BuchuMark size={40} /></div><span className="section-kicker">BUCHU ADMIN</span><h1>좋은 기회를 연결하는 일.</h1><p>기업 게재 신청과 익명 후기를 살펴보고<br />부업 강의와 주문을 관리하세요.</p><form onSubmit={login}><label htmlFor="admin-username">관리자 아이디</label><input id="admin-username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="관리자 아이디를 입력하세요" /><label htmlFor="admin-password">비밀번호</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" />{error && <p className="admin-error" role="alert">{error}</p>}<button className="button button-green" disabled={loginBusy}>{loginBusy ? "로그인 중…" : "관리자 로그인"}<Icon name="arrow" size={18} /></button></form><Link href="/">부추 홈으로 돌아가기</Link></section></div>;

  return <div className="container admin-page"><div className="admin-page-heading"><div><span className="section-kicker">PARTNER REVIEW CENTER</span><h1>운영 관리</h1><p>기업 게재 신청, 소통 글, 익명 평가, 스폰서 광고와 부업 강의·주문을 관리합니다.</p></div><div className="admin-account"><span>{session.username || "관리자"}</span><button onClick={logout}>로그아웃</button></div></div><div className="admin-section-tabs" role="tablist" aria-label="관리 메뉴"><button type="button" id="submission-admin-tab" role="tab" aria-selected={panel === "submissions"} aria-controls="submission-admin-panel" className={panel === "submissions" ? "active" : ""} onClick={() => selectPanel("submissions")}>게재 신청</button><button type="button" id="post-admin-tab" role="tab" aria-selected={panel === "posts"} aria-controls="post-admin-panel" className={panel === "posts" ? "active" : ""} onClick={() => selectPanel("posts")}>소통 글</button><button type="button" id="review-admin-tab" role="tab" aria-selected={panel === "reviews"} aria-controls="review-admin-panel" className={panel === "reviews" ? "active" : ""} onClick={() => selectPanel("reviews")}>익명 평가 관리</button><button type="button" id="ad-admin-tab" role="tab" aria-selected={panel === "ads"} aria-controls="ad-admin-panel" className={panel === "ads" ? "active" : ""} onClick={() => selectPanel("ads")}>스폰서 광고</button><button type="button" id="course-admin-tab" role="tab" aria-selected={panel === "courses"} aria-controls="course-admin-panel" className={panel === "courses" ? "active" : ""} onClick={() => selectPanel("courses")}>강의 관리</button><button type="button" id="course-order-admin-tab" role="tab" aria-selected={panel === "course-orders"} aria-controls="course-order-admin-panel" className={panel === "course-orders" ? "active" : ""} onClick={() => selectPanel("course-orders")}>강의 주문</button></div>{panel === "courses" ? <div id="course-admin-panel" role="tabpanel" aria-labelledby="course-admin-tab"><AdminCourses onSessionExpired={expireSession} onDirtyChange={setCourseDirty} /></div> : panel === "course-orders" ? <div id="course-order-admin-panel" role="tabpanel" aria-labelledby="course-order-admin-tab"><AdminCourseOrders onSessionExpired={expireSession} /></div> : panel === "ads" ? <div id="ad-admin-panel" role="tabpanel" aria-labelledby="ad-admin-tab"><AdminAds onSessionExpired={expireSession} /></div>: panel === "posts" ? <div id="post-admin-panel" role="tabpanel" aria-labelledby="post-admin-tab"><AdminPosts onSessionExpired={expireSession} /></div> : panel === "reviews" ? <div id="review-admin-panel" role="tabpanel" aria-labelledby="review-admin-tab"><AdminReviews onSessionExpired={expireSession} /></div> : <div id="submission-admin-panel" role="tabpanel" aria-labelledby="submission-admin-tab"><div className="admin-metrics">{(["PENDING", "APPROVED", "REJECTED"] as Status[]).map(value => <button key={value} className={`admin-metric ${status === value ? "active" : ""}`} onClick={() => { setStatus(value); setPage(0); }}><span>{statusLabels[value]}</span><strong>{list.counts?.[value] ?? 0}<small>건</small></strong><Icon name={value === "APPROVED" ? "check" : value === "REJECTED" ? "close" : "book"} size={22} /></button>)}</div>{feedback && <div className="admin-feedback" role="status"><Icon name="check" size={17} />{feedback}<button aria-label="알림 닫기" onClick={() => setFeedback("")}><Icon name="close" size={16} /></button></div>}{error && <p className="admin-error" role="alert">{error}</p>}<div className={`admin-workspace ${selectedId ? "has-selection" : ""}`}><section className="admin-list-panel" aria-label="신청 목록"><div className="admin-list-toolbar"><div className="admin-status-tabs">{(["ALL", "PENDING", "APPROVED", "REJECTED", "DRAFT"] as const).map(value => <button key={value} className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); }}>{value === "ALL" ? "전체" : statusLabels[value]}</button>)}</div><button className="admin-refresh" onClick={() => setRevision(value => value + 1)} disabled={loading}>새로고침</button></div><form className="admin-search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(0); }}><Icon name="search" size={18} /><input aria-label="신청 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="기업명, 서비스명으로 검색" maxLength={120} /><button type="submit">검색</button></form><div className="admin-result-count" role="status">{loading ? "신청을 불러오고 있어요…" : `총 ${list.total}건의 신청`}</div>{!loading && list.items.length === 0 ? <div className="admin-empty"><Icon name="book" size={32} /><h2>아직 해당하는 신청이 없어요</h2><p>기업이 신청을 제출하면 이곳에서 확인할 수 있어요.</p><Link href="/partners/apply">기업 게재 신청 화면 보기 <Icon name="arrow-up" size={15} /></Link></div> : <div className="admin-submission-list">{list.items.map(item => <button className={`admin-submission-row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); setPreview(false); setFeedback(""); }} aria-pressed={selectedId === item.id}><div><Badge status={item.status as Status} /><span className="admin-board-badge">{submissionBoardLabels[item.board || "MARKETER"]}</span><time>{date(item.submittedAt || item.updatedAt)}</time></div><h2>{item.name || "이름을 작성하지 않은 신청"}<Icon name="chevron" size={17} /></h2><p>{item.companyName || "기업 정보 작성 중"}</p></button>)}</div>}<div className="admin-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(list.total / 10))}</span><button disabled={(page + 1) * 10 >= list.total || loading} onClick={() => setPage(value => value + 1)}>다음</button></div></section>{selectedId && <section className="admin-detail-panel" aria-label="신청 검토"><div className="admin-detail-toolbar"><strong>신청 검토</strong><button aria-label="신청 검토 닫기" onClick={() => setSelectedId(null)}><Icon name="close" size={20} /></button></div>{detailLoading ? <p className="admin-loading" role="status">신청 내용을 불러오는 중입니다.</p> : selected && <><div className="admin-detail-heading"><Badge status={selected.status as Status} /><span className="admin-board-badge">{submissionBoardLabels[selected.board || "MARKETER"]}</span><h2>{selected.name || "작성 중인 신청"}</h2><p>{selected.tagline}</p><span>신청 번호 {selected.id}</span></div><div className="admin-detail-tabs"><button className={!preview ? "active" : ""} onClick={() => setPreview(false)}>신청 정보</button><button className={preview ? "active" : ""} onClick={() => setPreview(true)}>상세페이지 미리보기</button></div>{preview ? <div className="admin-content-preview">{safeContentUrl(selected.thumbnailUrl, true) && <img className="admin-preview-cover" src={selected.thumbnailUrl!} alt={`${selected.name} 대표 이미지`} />}<DetailContent content={selected.content} /></div> : <div className="admin-details"><h3>기업 및 담당자 정보 <small>사업자·담당자 정보는 비공개</small></h3><dl>{[["기업명", selected.companyName], ["사업자등록번호", selected.businessNumber], ["담당자", selected.contactName], ["이메일", selected.contactEmail], ["연락처", selected.contactPhone]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "미입력"}</dd></div>)}</dl><h3>서비스 소개</h3><p className="admin-description">{selected.description || "소개를 작성하지 않았습니다."}</p><dl><div><dt>게시판</dt><dd>{submissionBoardLabels[selected.board || "MARKETER"]}</dd></div>{selected.board === "HELP" && <><div><dt>등록 목적</dt><dd>{helpTypeLabels[selected.helpType || "PROMOTION"]}</dd></div><div><dt>활동 지역</dt><dd>{selected.location || "별도 문의"}</dd></div><div><dt>모집 기한</dt><dd>{selected.deadline || "상시 모집"}</dd></div></>}<div><dt>{selected.board === "HELP" ? "문의 · 지원 링크" : "공식 사이트"}</dt><dd>{safeContentUrl(selected.officialUrl) ? <a href={selected.officialUrl} target="_blank" rel="noopener noreferrer">{selected.officialUrl} ↗</a> : "미입력"}</dd></div><div><dt>활동 채널</dt><dd>{(selected.channels || []).map(channel => channelLabels[channel]).join(" · ") || "미입력"}</dd></div><div><dt>시작 비용</dt><dd>{selected.costLabel || "확인 필요"}</dd></div><div><dt>{selected.board === "HELP" ? "보상 조건" : "수익 방식"}</dt><dd>{selected.commission || "미입력"}</dd></div><div><dt>{selected.board === "HELP" ? "지급 조건" : "정산 안내"}</dt><dd>{selected.settlement || "미입력"}</dd></div><div><dt>접수 일시</dt><dd>{date(selected.submittedAt)}</dd></div></dl>{selected.publishedSlug && <Link href={`/${selected.board === "HELP" ? "help" : "programs"}/${encodeURIComponent(selected.publishedSlug)}`} className="admin-public-link" target="_blank">공개된 상세페이지 보기 <Icon name="arrow-up" size={16} /></Link>}</div>}{selected.reviewNote && <div className="admin-review-note"><strong>최근 심사 의견</strong><p>{selected.reviewNote}</p></div>}{selected.reviewEvents && selected.reviewEvents.length > 0 && <details className="admin-history"><summary>심사 기록 {selected.reviewEvents.length}건</summary><ol>{selected.reviewEvents.map((event, index) => <li key={`${event.reviewedAt}-${index}`}><strong>{event.decision === "APPROVED" ? "승인" : "거절"}</strong><span>{event.reviewedBy} · {date(event.reviewedAt)}</span><p>{event.note || "별도 의견 없음"}</p></li>)}</ol></details>}{selected.status === "PENDING" && <div className="admin-review-actions">{intent ? <form onSubmit={review}><h3>{intent === "APPROVED" ? "이 서비스를 부추에 게재할까요?" : "이 신청을 거절할까요?"}</h3><p>{intent === "APPROVED" ? "승인하면 소개와 이미지가 공개 목록에 게시됩니다." : "작성한 사유는 신청자에게 표시됩니다. 필요한 수정 사항을 알려 주세요."}</p><label htmlFor="review-note">{intent === "REJECTED" ? "거절 사유 (필수)" : "심사 의견 (선택)"}</label><textarea id="review-note" value={note} onChange={event => setNote(event.target.value)} required={intent === "REJECTED"} maxLength={2000} rows={4} placeholder="검토 의견을 작성해 주세요." /><div><button type="button" className="button button-outline" disabled={reviewBusy} onClick={() => setIntent(null)}>취소</button><button type="submit" className={`button ${intent === "APPROVED" ? "button-green" : "button-reject"}`} disabled={reviewBusy}>{reviewBusy ? "처리 중…" : intent === "APPROVED" ? "승인 확정" : "거절 확정"}</button></div></form> : <><p><Icon name="info" size={15} />상세페이지와 서비스 정보를 확인한 후 결정해 주세요.</p><div><button className="button button-outline" onClick={() => { setIntent("REJECTED"); setDetailError(""); }}>거절하기</button><button className="button button-green" onClick={() => { setIntent("APPROVED"); setDetailError(""); }}>승인하고 게재하기 <Icon name="check" size={17} /></button></div></>}</div>}</>}{detailError && <p className="admin-error" role="alert">{detailError}</p>}</section>}</div></div>}</div>;
}
