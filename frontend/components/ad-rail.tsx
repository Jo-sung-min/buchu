"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { adMonthlyPrice, adTotalSlots, type PublicAd } from "@/lib/ads";
import { Icon } from "./icons";

function safeHref(value: string) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}

/** One side of the page: the legacy image banner (if configured), sponsor tiles, then a "+" tile that sells the empty spots. */
export function AdRail({ side, items, remaining, loaded, banner }: { side: "left" | "right"; items: PublicAd[]; remaining: number; loaded: boolean; banner?: ReactNode }) {
  const perSide = adTotalSlots / 2;
  const empty = Math.max(0, perSide - items.length);
  return <div className="ad-rail" data-side={side}>
    {banner}
    <span className="ad-slot-label">SPONSORS</span>
    <ul className="ad-tiles">
      {items.map(ad => {
        const href = safeHref(ad.url);
        const initials = ad.siteName.trim().slice(0, 2);
        const body = <><span className="ad-tile-mark" aria-hidden="true">{initials}</span><strong>{ad.siteName}</strong><p>{ad.tagline}</p></>;
        return <li key={ad.id} className="ad-tile" style={{ "--tile-color": ad.color } as React.CSSProperties}>
          {href ? <a href={href} target="_blank" rel="sponsored noopener noreferrer" aria-label={`${ad.siteName} 바로가기 (새 창)`}>{body}</a> : <div>{body}</div>}
        </li>;
      })}
      {loaded && empty > 0 && <li className="ad-tile ad-tile-open">
        <Link href="/ads/apply" aria-label={`내 사이트 광고하기, 월 ${adMonthlyPrice.toLocaleString("ko-KR")}원`}>
          <span className="ad-tile-plus" aria-hidden="true"><Icon name="plus" size={18} /></span>
          <strong>내 사이트 광고하기</strong>
          <p>월 {(adMonthlyPrice / 10_000).toLocaleString("ko-KR")}만 원</p>
          <small>{remaining}/{adTotalSlots} 자리 남음</small>
        </Link>
      </li>}
      {loaded && Array.from({ length: Math.max(0, empty - 1) }, (_, index) => <li key={`empty-${index}`} className="ad-tile ad-tile-empty" aria-hidden="true" />)}
    </ul>
  </div>;
}
