"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { adTotalSlots, adVisibleSlots, type PublicAd } from "@/lib/ads";
import { Icon } from "./icons";
import { FlipTile } from "./ads/flip-tile";

/** One side of the page: the legacy image banner (if configured), sponsor cards that flip to reveal the overflow, then a "+" tile. */
export function AdRail({ side, items, remaining, loaded, banner }: { side: "left" | "right"; items: PublicAd[]; remaining: number; loaded: boolean; banner?: ReactNode }) {
  const perSide = adVisibleSlots / 2;
  const positions = Array.from({ length: Math.min(perSide, items.length) }, (_, index) => ({ front: items[index], back: items[index + perSide] }));
  const empty = Math.max(0, perSide - positions.length);
  return <div className="ad-rail" data-side={side}>
    {banner}
    <span className="ad-slot-label">SPONSORS</span>
    <ul className="ad-tiles">
      {positions.map((position, index) => <li key={position.front.id}><FlipTile front={position.front} back={position.back} offsetMs={(index * 2 + (side === "right" ? 1 : 0)) * 700} /></li>)}
      {loaded && remaining > 0 && <li className="ad-tile ad-tile-open">
        <Link href="/ads/apply" aria-label="내 사이트 광고하기">
          <span className="ad-tile-plus" aria-hidden="true"><Icon name="plus" size={18} /></span>
          <strong>내 사이트 광고하기</strong>
          <small>{remaining}/{adTotalSlots} 자리 남음</small>
        </Link>
      </li>}
      {loaded && Array.from({ length: Math.max(0, empty - 1) }, (_, index) => <li key={`empty-${index}`} className="ad-tile ad-tile-empty" aria-hidden="true" />)}
    </ul>
  </div>;
}
