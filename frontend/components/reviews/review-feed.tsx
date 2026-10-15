"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteReview, fetchReviews, getReviewToken, reviewDate, reviewsChangedEvent, type Review, type ReviewPage, type ReviewSort } from "@/lib/reviews";

export function ReviewStars({ rating }: { rating: number }) {
  return <span className="review-stars" aria-label={`5점 만점에 ${rating}점`}><span aria-hidden="true">{"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}<span className="review-stars-empty">{"★".repeat(Math.max(0, 5 - Math.min(5, Math.round(rating))))}</span></span></span>;
}

function ReviewItem({ review, compact, hideProgram }: { review: Review; compact?: boolean; hideProgram?: boolean }) {
  const [ownToken, setOwnToken] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setOwnToken(getReviewToken(review.id)); }, [review.id]);

  async function remove() {
    if (busy) return;
    const token = ownToken || manualToken.trim();
    if (!token) { setError("후기 작성 시 받은 삭제 코드를 입력해 주세요."); return; }
    setBusy(true); setError("");
    try { await deleteReview(review.id, token); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "후기를 삭제하지 못했어요."); setBusy(false); }
  }

  return <article className={`review-item${compact ? " review-item-compact" : ""}`} id={`review-${review.id}`}>
    <div className="review-item-top">{!hideProgram && <Link href={`/programs/${encodeURIComponent(review.programSlug)}`} className="review-program-name">{review.programName}</Link>}<ReviewStars rating={review.rating} /><span className="review-rating-number">{review.rating.toFixed(1)}</span></div>
    <h3>{compact ? <Link href={`/programs/${encodeURIComponent(review.programSlug)}#review-${review.id}`}>{review.title}</Link> : review.title}</h3>
    <p className="review-body">{review.content}</p>
    <div className="review-item-meta"><span className="review-anonymous-avatar" aria-hidden="true">익</span><span>{review.nickname}</span><span className="review-meta-dot" aria-hidden="true">·</span><time dateTime={review.createdAt}>{reviewDate(review.createdAt)}</time><button type="button" className="review-delete-trigger" onClick={() => { setConfirming(!confirming); setError(""); }}>{ownToken ? "내 후기 삭제" : "삭제"}</button></div>
    {confirming && <div className="review-delete-panel"><strong>이 후기를 삭제할까요?</strong><p>삭제한 후기는 되돌릴 수 없어요.{!ownToken && " 작성할 때 받은 삭제 코드가 필요해요."}</p>{!ownToken && <input type="password" aria-label="후기 삭제 코드" value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="삭제 코드" autoComplete="off" disabled={busy} />}{error && <p className="review-error" role="alert">{error}</p>}<div><button type="button" className="review-button review-button-quiet" disabled={busy} onClick={() => { setConfirming(false); setManualToken(""); }}>취소</button><button type="button" className="review-button review-button-primary" disabled={busy} onClick={remove}>{busy ? "삭제하는 중…" : "후기 삭제"}</button></div></div>}
  </article>;
}

export function ReviewFeed({ programSlug, compact = false }: { programSlug?: string; compact?: boolean }) {
  const [data, setData] = useState<ReviewPage | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<ReviewSort>("latest");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrolledHash = useRef("");
  const size = compact ? 4 : 10;

  useEffect(() => { setPage(0); }, [programSlug]);

  useEffect(() => {
    const refresh = () => { setVersion((value) => value + 1); };
    window.addEventListener(reviewsChangedEvent, refresh);
    return () => window.removeEventListener(reviewsChangedEvent, refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetchReviews({ programSlug, sort, page, size, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.items.length && page > 0 && result.total <= page * size) { setPage(Math.max(0, Math.ceil(result.total / size) - 1)); return; }
        setData(result);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "후기를 불러오지 못했어요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [programSlug, sort, page, size, version]);

  useEffect(() => {
    if (loading || compact || !data) return;
    const hash = window.location.hash;
    if (!hash || hash === scrolledHash.current) return;
    const review = data.items.find((item) => hash === `#review-${item.id}`);
    if (review) {
      document.getElementById(`review-${review.id}`)?.scrollIntoView({ block: "start" });
      scrolledHash.current = hash;
    }
  }, [data, loading, compact]);

  const writeHref = `/reviews/write${programSlug ? `?program=${encodeURIComponent(programSlug)}` : ""}`;
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  return <div className={`review-feed${compact ? " review-feed-compact" : ""}`} aria-busy={loading}>
    {!compact && <div className="review-feed-toolbar"><span>후기 <strong>{data ? data.total.toLocaleString() : "—"}</strong></span><label><span className="review-visually-hidden">후기 정렬</span><select value={sort} onChange={(event) => { setSort(event.target.value as ReviewSort); setPage(0); }} disabled={loading}><option value="latest">최신순</option><option value="rating_desc">별점 높은순</option></select></label></div>}
    {error ? <div className="review-load-error" role="alert"><p>{error}</p><button className="review-button review-button-quiet" onClick={() => setVersion((value) => value + 1)}>다시 불러오기</button></div> : loading ? <div className="review-loading" role="status">후기 불러오는 중…</div> : data?.items.length ? <div className="review-items">{data.items.map((review) => <ReviewItem key={review.id} review={review} compact={compact} hideProgram={!!programSlug} />)}</div> : <div className="review-empty"><strong>아직 후기가 없어요</strong><Link href={writeHref} className="review-button review-button-quiet">후기 쓰기</Link></div>}
    {!error && !loading && data && data.items.length > 0 && (compact ? <Link href={programSlug ? `/programs/${encodeURIComponent(programSlug)}#reviews` : "/reviews"} className="review-view-all">후기 전체 보기 <span aria-hidden="true">→</span></Link> : pages > 1 ? <nav className="review-pagination" aria-label="후기 페이지"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>이전</button><span><strong>{page + 1}</strong> / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>다음</button></nav> : null)}
  </div>;
}
