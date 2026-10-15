"use client";

import { useEffect, useState } from "react";
import { fetchReviewSummary, reviewsChangedEvent, type ReviewSummary } from "@/lib/reviews";
import { ReviewFeed, ReviewStars } from "./review-feed";
import { ReviewForm } from "./review-form";

export function ProgramReviews({ programSlug, programName }: { programSlug: string; programName: string }) {
  const [summary, setSummary] = useState<ReviewSummary["programs"][number] | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener(reviewsChangedEvent, refresh);
    return () => window.removeEventListener(reviewsChangedEvent, refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoaded(false);
    fetchReviewSummary(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setSummary(result.programs.find((item) => item.programSlug === programSlug) ?? null); setSummaryLoaded(true); }
    }).catch(() => { if (!controller.signal.aborted) setSummaryLoaded(false); });
    return () => controller.abort();
  }, [programSlug, version]);

  return <section className="program-reviews" id="reviews" aria-labelledby="program-reviews-heading">
    <div className="review-section-heading"><div><span className="review-section-eyebrow">직접 해본 사람들의 이야기</span><h2 id="program-reviews-heading">익명 부업 평가</h2></div><button type="button" className="review-button review-button-primary" onClick={() => setFormOpen(!formOpen)} aria-expanded={formOpen} aria-controls="program-review-editor">{formOpen ? "작성 닫기" : "후기 쓰기"}</button></div>
    {summaryLoaded && <div className="review-summary-strip">{summary && summary.reviewCount > 0 && summary.averageRating !== null ? <><strong>{summary.averageRating.toFixed(1)}</strong><ReviewStars rating={summary.averageRating} /><span>{summary.reviewCount.toLocaleString()}개의 경험이 모였어요</span></> : <><strong>—</strong><span>첫 번째 경험을 기다리고 있어요</span></>}</div>}
    {formOpen && <div className="review-inline-editor" id="program-review-editor"><h3>{programName}, 직접 해보셨나요?</h3><ReviewForm programs={[{ slug: programSlug, name: programName }]} initialProgramSlug={programSlug} fixedProgram /></div>}
    <ReviewFeed programSlug={programSlug} />
  </section>;
}
