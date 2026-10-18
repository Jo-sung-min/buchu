"use client";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { adColors, adMonthlyPrice, applyAd, faviconFor, krw, type Advertisement } from "@/lib/ads";
import { AdTile } from "./ad-tile";

export function AdApplyForm() {
  const id = useId();
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(adColors[1]);
  const [imageUrl, setImageUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Advertisement | null>(null);
  const autoIcon = faviconFor(url.trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try { setDone(await applyAd({ siteName: siteName.trim(), tagline: tagline.trim(), url: url.trim(), contactEmail: email.trim(), color, imageUrl: imageUrl.trim(), iconUrl: iconUrl.trim() })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "신청을 접수하지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (done) return <div className="review-success" role="status">
    <span className="review-success-icon" aria-hidden="true">✓</span>
    <h3>광고 신청을 접수했어요.</h3>
    <p><strong>{done.siteName}</strong> 광고 신청이 대기 상태로 등록됐습니다. <strong>{done.contactEmail}</strong>로 결제 안내(월 {krw(adMonthlyPrice)})를 보내 드릴게요. 입금이 확인되면 게재가 시작돼요.</p>
    <p className="review-storage-note">신청 번호 {done.id}</p>
    <div className="review-success-actions"><Link className="review-button review-button-primary" href="/">홈으로</Link><button type="button" className="review-button review-button-quiet" onClick={() => { setDone(null); setSiteName(""); setTagline(""); setUrl(""); setImageUrl(""); setIconUrl(""); }}>다른 사이트 신청</button></div>
  </div>;

  return <form className="review-form ad-apply-form" onSubmit={submit} aria-label="광고 신청">
    <div className="ad-apply-layout">
      <div className="ad-apply-preview" aria-label="카드 미리보기">
        <span className="ad-slot-label">미리보기</span>
        <AdTile ad={{ siteName: siteName.trim(), tagline: tagline.trim(), url: url.trim(), color, imageUrl: imageUrl.trim(), iconUrl: iconUrl.trim() }} className="ad-tile-preview" />
        <p>양옆 스폰서 영역에 이 모습 그대로 노출돼요.</p>
      </div>
      <div className="ad-apply-fields">
        <div className="review-field"><label htmlFor={`${id}-name`}>사이트 이름</label><input id={`${id}-name`} value={siteName} onChange={event => setSiteName(event.target.value)} placeholder="예: 부추툴즈" minLength={2} maxLength={40} required disabled={busy} /></div>
        <div className="review-field"><label htmlFor={`${id}-tagline`}>한 줄 소개</label><input id={`${id}-tagline`} value={tagline} onChange={event => setTagline(event.target.value)} placeholder="예: 쿠팡 파트너스 링크 자동 생성기" minLength={2} maxLength={60} required disabled={busy} aria-describedby={`${id}-tagline-count`} /><span className="review-character-count" id={`${id}-tagline-count`}>{tagline.length}/60</span></div>
        <div className="review-field"><label htmlFor={`${id}-url`}>사이트 주소</label><input id={`${id}-url`} type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" required disabled={busy} /><span className="review-character-count">{autoIcon ? "이 주소의 파비콘을 카드에 자동으로 넣어요." : "주소를 넣으면 파비콘을 자동으로 가져와요."}</span></div>
        <div className="review-field"><label htmlFor={`${id}-image`}>배경 이미지 주소 <small>(선택)</small></label><input id={`${id}-image`} type="url" inputMode="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https:// … .png / .jpg / .webp" disabled={busy} /><span className="review-character-count">https 이미지 링크. 비워 두면 선택한 색상으로 채워요. 세로형(4:5 비율)이 가장 잘 맞아요.</span></div>
        <div className="review-field"><label htmlFor={`${id}-icon`}>파비콘 주소 <small>(선택)</small></label><input id={`${id}-icon`} type="url" inputMode="url" value={iconUrl} onChange={event => setIconUrl(event.target.value)} placeholder="자동으로 가져온 파비콘 대신 쓸 로고 이미지" disabled={busy} /></div>
        <div className="review-field"><label htmlFor={`${id}-email`}>담당자 이메일</label><input id={`${id}-email`} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="결제 안내를 받을 주소" required disabled={busy} /><span className="review-character-count">공개되지 않아요</span></div>
        <fieldset className="ad-color-field" disabled={busy}><legend>카드 색상</legend><div>{adColors.map(value => <label key={value} className={color === value ? "active" : ""} style={{ "--tile-color": value } as React.CSSProperties}><input type="radio" name={`${id}-color`} value={value} checked={color === value} onChange={() => setColor(value)} aria-label={`색상 ${value}`} /></label>)}</div><span className="review-character-count">배경 이미지가 없을 때 카드 배경과 테두리에 쓰여요.</span></fieldset>
      </div>
    </div>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions"><span>월 {krw(adMonthlyPrice)} · 입금 확인 후 게재</span><button type="submit" className="review-button review-button-primary" disabled={busy}>{busy ? "접수 중…" : "광고 신청"}</button></div>
  </form>;
}
