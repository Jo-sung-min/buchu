"use client";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { adColors, adMonthlyPrice, applyAd, krw, type Advertisement } from "@/lib/ads";

export function AdApplyForm() {
  const id = useId();
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(adColors[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Advertisement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try { setDone(await applyAd({ siteName: siteName.trim(), tagline: tagline.trim(), url: url.trim(), contactEmail: email.trim(), color })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "신청을 접수하지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (done) return <div className="review-success" role="status">
    <span className="review-success-icon" aria-hidden="true">✓</span>
    <h3>광고 신청을 접수했어요.</h3>
    <p><strong>{done.siteName}</strong> 광고 신청이 대기 상태로 등록됐습니다. <strong>{done.contactEmail}</strong>로 결제 안내(월 {krw(adMonthlyPrice)})를 보내 드릴게요. 입금이 확인되면 게재가 시작돼요.</p>
    <p className="review-storage-note">신청 번호 {done.id}</p>
    <div className="review-success-actions"><Link className="review-button review-button-primary" href="/">홈으로</Link><button type="button" className="review-button review-button-quiet" onClick={() => { setDone(null); setSiteName(""); setTagline(""); setUrl(""); }}>다른 사이트 신청</button></div>
  </div>;

  return <form className="review-form ad-apply-form" onSubmit={submit} aria-label="광고 신청">
    <div className="ad-apply-preview" aria-label="타일 미리보기">
      <span className="ad-slot-label">미리보기</span>
      <div className="ad-tile" style={{ "--tile-color": color } as React.CSSProperties}><div><span className="ad-tile-mark" aria-hidden="true">{siteName.trim().slice(0, 2) || "AD"}</span><strong>{siteName.trim() || "사이트 이름"}</strong><p>{tagline.trim() || "한 줄 소개가 여기에 보여요"}</p></div></div>
    </div>
    <div className="review-field"><label htmlFor={`${id}-name`}>사이트 이름</label><input id={`${id}-name`} value={siteName} onChange={event => setSiteName(event.target.value)} placeholder="예: 부추툴즈" minLength={2} maxLength={40} required disabled={busy} /></div>
    <div className="review-field"><label htmlFor={`${id}-tagline`}>한 줄 소개</label><input id={`${id}-tagline`} value={tagline} onChange={event => setTagline(event.target.value)} placeholder="예: 쿠팡 파트너스 링크 자동 생성기" minLength={2} maxLength={60} required disabled={busy} aria-describedby={`${id}-tagline-count`} /><span className="review-character-count" id={`${id}-tagline-count`}>{tagline.length}/60</span></div>
    <div className="review-field"><label htmlFor={`${id}-url`}>사이트 주소</label><input id={`${id}-url`} type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" required disabled={busy} /></div>
    <div className="review-field"><label htmlFor={`${id}-email`}>담당자 이메일</label><input id={`${id}-email`} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="결제 안내를 받을 주소" required disabled={busy} /><span className="review-character-count">공개되지 않아요</span></div>
    <fieldset className="ad-color-field" disabled={busy}><legend>타일 색상</legend><div>{adColors.map(value => <label key={value} className={color === value ? "active" : ""} style={{ "--tile-color": value } as React.CSSProperties}><input type="radio" name={`${id}-color`} value={value} checked={color === value} onChange={() => setColor(value)} aria-label={`색상 ${value}`} /></label>)}</div></fieldset>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions"><span>월 {krw(adMonthlyPrice)} · 입금 확인 후 게재</span><button type="submit" className="review-button review-button-primary" disabled={busy}>{busy ? "접수 중…" : "광고 신청"}</button></div>
  </form>;
}
