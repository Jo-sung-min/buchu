"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/submissions";
import type { Program } from "@/lib/types";
import { Icon } from "./icons";

type ModeratedReview = {
  id: string;
  programSlug: string;
  programName: string;
  rating: number;
  title: string;
  content: string;
  nickname: string;
  createdAt: string;
};
type ReviewList = { items: ModeratedReview[]; total: number; page: number; size: number };
type ProgramOption = Pick<Program, "slug" | "name" | "board">;

function createdDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function AdminReviews({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [programSlug, setProgramSlug] = useState("");
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState(false);
  const [programsRevision, setProgramsRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ReviewList>({ items: [], total: 0, page: 0, size: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProgramsLoading(true); setProgramsError(false);
    api<{ items: ProgramOption[] }>("/api/programs", { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setPrograms(response.items.filter(program => (program.board ?? "MARKETER") === "MARKETER").sort((left, right) => left.name.localeCompare(right.name, "ko")));
    }).catch(() => {
      if (!controller.signal.aborted) setProgramsError(true);
    }).finally(() => { if (!controller.signal.aborted) setProgramsLoading(false); });
    return () => controller.abort();
  }, [programsRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setConfirmId(null);
    const query = new URLSearchParams({ sort: "latest", page: String(page), size: "10" });
    if (programSlug) query.set("programSlug", programSlug);
    api<ReviewList>(`/api/admin/reviews?${query}`, { signal: controller.signal }).then(setList).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "평가 목록을 불러오지 못했습니다.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [programSlug, page, revision, onSessionExpired]);

  async function removeReview(review: ModeratedReview) {
    if (deletingId) return;
    setDeletingId(review.id); setError(""); setFeedback("");
    try {
      await api(`/api/admin/reviews/${encodeURIComponent(review.id)}`, { method: "DELETE" });
      setConfirmId(null);
      setFeedback("평가를 삭제했습니다. 공개 평가 목록과 평균 별점에 반영됩니다.");
      if (list.items.length === 1 && page > 0) setPage(value => value - 1);
      else setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "평가를 삭제하지 못했습니다.");
    } finally { setDeletingId(null); }
  }

  return <section className="admin-reviews" aria-label="익명 평가 관리">
    <div className="admin-reviews-heading"><div><h2>익명 평가</h2><p>개인정보 노출, 광고, 도배 등 운영 기준을 위반한 평가를 확인하고 삭제하세요.</p></div><button type="button" className="admin-refresh" disabled={loading || !!deletingId} onClick={() => setRevision(value => value + 1)}>새로고침</button></div>
    <div className="admin-search"><Icon name="search" size={18} /><label className="submission-sr-only" htmlFor="admin-review-program">평가 대상 프로그램</label><select id="admin-review-program" value={programSlug} disabled={!!deletingId} onChange={event => { setProgramSlug(event.target.value); setPage(0); setFeedback(""); }} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", padding: "4px 0" }}><option value="">전체 프로그램</option>{programs.map(program => <option key={program.slug} value={program.slug}>{program.name}</option>)}</select>{programSlug && <button type="button" disabled={!!deletingId} onClick={() => { setProgramSlug(""); setPage(0); setFeedback(""); }}>전체 보기</button>}</div>
    {programsLoading && <p className="admin-result-count" role="status">프로그램 목록을 불러오고 있습니다…</p>}
    {programsError && <div className="admin-feedback" role="status"><span>프로그램 목록을 불러오지 못했습니다. 전체 평가는 계속 확인할 수 있습니다.</span><button type="button" className="admin-refresh" onClick={() => setProgramsRevision(value => value + 1)}>목록 다시 불러오기</button></div>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    <div className="admin-result-count" role="status">{loading ? "평가를 불러오고 있습니다…" : `총 ${list.total}개의 평가 · 최신순`}</div>
    {!loading && !error && list.items.length === 0 && <div className="admin-empty"><Icon name="book" size={30} /><h3>등록된 평가가 없습니다</h3><p>방문자가 남긴 익명 평가를 여기에서 관리할 수 있습니다.</p></div>}
    <div className="admin-review-items" aria-busy={loading}>{list.items.map(review => <article className="admin-review-item" key={review.id}>
      <div className="admin-review-meta"><Link href={`/programs/${encodeURIComponent(review.programSlug)}#reviews`} target="_blank">{review.programName || "프로그램 보기"} ↗</Link><time dateTime={review.createdAt}>{createdDate(review.createdAt)}</time></div>
      <div className="admin-review-rating"><span aria-label={`5점 만점에 ${review.rating}점`}>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}{"☆".repeat(Math.max(0, 5 - review.rating))}</span><span>{review.nickname || "익명"}</span></div>
      <h3>{review.title}</h3><p className="admin-review-body">{review.content}</p>
      {confirmId === review.id ? <div className="admin-review-delete-confirm"><p>이 평가를 삭제할까요? 공개 목록에서 사라지며 복구할 수 없습니다.</p><div><button type="button" className="button button-outline" disabled={!!deletingId} onClick={() => setConfirmId(null)}>취소</button><button type="button" className="button button-reject" disabled={!!deletingId} onClick={() => void removeReview(review)}>{deletingId === review.id ? "삭제 중…" : "평가 삭제 확정"}</button></div></div> : <button type="button" className="admin-review-delete" disabled={loading || !!deletingId} onClick={() => setConfirmId(review.id)}>평가 삭제</button>}
    </article>)}</div>
    <div className="admin-pagination"><button type="button" disabled={page === 0 || loading || !!deletingId} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(list.total / 10))}</span><button type="button" disabled={(page + 1) * 10 >= list.total || loading || !!deletingId} onClick={() => setPage(value => value + 1)}>다음</button></div>
  </section>;
}
