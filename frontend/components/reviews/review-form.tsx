"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { announceReviewChange, rememberReviewToken, writeReview, type Review, type ReviewProgram } from "@/lib/reviews";

const ratingLabels = ["아쉬워요", "조금 아쉬워요", "보통이에요", "만족해요", "추천해요"];

export function ReviewForm({ programs, initialProgramSlug, fixedProgram, onSubmitted }: {
  programs: ReviewProgram[];
  initialProgramSlug?: string;
  fixedProgram?: boolean;
  onSubmitted?: (review: Review) => void;
}) {
  const id = useId();
  const feedback = useRef<HTMLDivElement>(null);
  const [programSlug, setProgramSlug] = useState(programs.some((program) => program.slug === initialProgramSlug) ? initialProgramSlug! : programs.length === 1 ? programs[0].slug : "");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ review: Review; deleteToken: string; saved: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!programSlug) { setError("평가할 부업을 선택해 주세요."); return; }
    if (rating < 1) { setError("별점을 선택해 주세요."); return; }
    if (title.trim().length < 3 || content.trim().length < 10) {
      setError("제목은 3자 이상, 후기는 10자 이상으로 작성해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const result = await writeReview(programSlug, { rating, title: title.trim(), content: content.trim() });
      const saved = rememberReviewToken(result.review.id, result.deleteToken);
      setSuccess({ ...result, saved });
      setRating(0); setTitle(""); setContent("");
      announceReviewChange();
      onSubmitted?.(result.review);
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "후기를 등록하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  async function copyCode() {
    if (!success) return;
    try { await navigator.clipboard.writeText(success.deleteToken); setCopied(true); }
    catch { setCopied(false); setError("자동 복사를 사용할 수 없어요. 삭제 코드를 직접 선택해 복사해 주세요."); }
  }

  if (success) return <div className="review-success" tabIndex={-1} ref={feedback} role="status">
    <span className="review-success-icon" aria-hidden="true">✓</span>
    <h3>익명 후기를 남겼어요.</h3>
    <p><strong>{success.review.nickname}</strong> 이름으로 게시됐습니다. 함께 시작할 사람들에게 도움이 될 거예요.</p>
    {success.saved ? <p className="review-storage-note">이 브라우저에 삭제 코드를 저장했어요. 같은 기기·브라우저에서 내 후기를 삭제할 수 있어요.</p> : <p className="review-storage-warning">이 브라우저에 삭제 코드를 저장하지 못했어요. 아래 코드를 꼭 보관해 주세요. 후기의 ‘삭제’에서 사용할 수 있어요.</p>}
    <details className="review-recovery" open={!success.saved}>
      <summary>삭제 코드 보관하기</summary>
      <p>브라우저 데이터를 지우거나 기기를 바꾸면 이 코드가 필요해요. 다른 사람에게 공유하지 마세요.</p>
      <div className="review-recovery-row"><input aria-label="내 후기 삭제 코드" readOnly value={success.deleteToken} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="review-button review-button-quiet" onClick={copyCode}>{copied ? "복사했어요" : "코드 복사"}</button></div>
    </details>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-success-actions"><Link className="review-button review-button-primary" href={`/programs/${encodeURIComponent(success.review.programSlug)}#review-${success.review.id}`}>작성한 후기 보기</Link><button type="button" className="review-button review-button-quiet" onClick={() => { setSuccess(null); setError(""); setCopied(false); }}>다른 후기 작성</button></div>
  </div>;

  return <form className="review-form" onSubmit={submit} aria-label="익명 부업 후기 작성">
    {!fixedProgram && <div className="review-field"><label htmlFor={`${id}-program`}>어떤 부업을 경험했나요?</label><select id={`${id}-program`} value={programSlug} onChange={(event) => setProgramSlug(event.target.value)} required disabled={busy || !programs.length}><option value="">평가할 부업을 선택해 주세요</option>{programs.map((program) => <option key={program.slug} value={program.slug}>{program.name}</option>)}</select></div>}
    {!programs.length && <p className="review-error">현재 평가할 수 있는 부업이 없어요. 잠시 후 다시 방문해 주세요.</p>}
    <fieldset className="review-rating-field" disabled={busy}>
      <legend>직접 해보니 어땠나요?</legend>
      <div className="review-rating-options">{ratingLabels.map((label, index) => <label key={label} className={rating >= index + 1 ? "is-filled" : ""}><input type="radio" name={`${id}-rating`} value={index + 1} checked={rating === index + 1} onChange={() => setRating(index + 1)} aria-label={`${index + 1}점 · ${label}`} required /><span aria-hidden="true">★</span></label>)}<span className="review-rating-caption" aria-live="polite">{rating ? `${rating}점 · ${ratingLabels[rating - 1]}` : "별점을 선택해 주세요"}</span></div>
    </fieldset>
    <div className="review-field"><label htmlFor={`${id}-title`}>한 줄로 정리하면</label><input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 글 쓰는 걸 좋아한다면 시작해 볼 만해요" minLength={3} maxLength={80} required disabled={busy} aria-describedby={`${id}-title-count`} /><span className="review-character-count" id={`${id}-title-count`}>{title.length}/80</span></div>
    <div className="review-field"><label htmlFor={`${id}-content`}>솔직한 경험을 들려주세요</label><textarea id={`${id}-content`} value={content} onChange={(event) => setContent(event.target.value)} placeholder={"좋았던 점, 아쉬웠던 점, 시작 전에 알았으면 하는 점을 적어주세요.\n활동 기간이나 주로 사용한 채널도 함께 알려주면 좋아요."} minLength={10} maxLength={2000} required disabled={busy} rows={7} aria-describedby={`${id}-content-count ${id}-guidance`} /><span className="review-character-count" id={`${id}-content-count`}>{content.length.toLocaleString()}/2,000</span></div>
    <div className="review-writing-note" id={`${id}-guidance`}><strong>이름 대신, 경험으로 이야기해요.</strong><p>닉네임은 자동으로 만들어져요. 직접 경험한 내용을 적고, 이름·연락처 등 개인정보와 광고·욕설은 넣지 말아 주세요.</p><p>게시 후에는 이 브라우저에 저장되는 삭제 코드로 내 후기를 삭제할 수 있어요.</p></div>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions"><span>익명으로 공개됩니다</span><button type="submit" className="review-button review-button-primary" disabled={busy || !programs.length}>{busy ? "등록하는 중…" : "익명 후기 등록"}</button></div>
  </form>;
}
