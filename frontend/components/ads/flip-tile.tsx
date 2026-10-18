"use client";
import { useEffect, useState } from "react";
import type { PublicAd } from "@/lib/ads";
import { AdTile } from "./ad-tile";

function safeHref(value: string) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}

/** One rail position holding up to two sponsors: the back one appears when the card flips every few seconds. */
export function FlipTile({ front, back, intervalMs = 9000, offsetMs = 0 }: { front: PublicAd; back?: PublicAd; intervalMs?: number; offsetMs?: number }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!back) { setFlipped(false); return; }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = setInterval(() => setFlipped(value => !value), intervalMs);
      return () => clearInterval(timer);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setFlipped(true);
      timer = setInterval(() => setFlipped(value => !value), intervalMs);
    }, intervalMs + offsetMs);
    return () => { clearTimeout(start); if (timer) clearInterval(timer); };
  }, [back, intervalMs, offsetMs]);
  if (!back) return <AdTile ad={front} href={safeHref(front.url)} />;
  return <div className={`ad-flip${flipped ? " is-flipped" : ""}`}>
    <div className="ad-flip-inner">
      <div className="ad-flip-face ad-flip-front" aria-hidden={flipped}><AdTile ad={front} href={safeHref(front.url)} /></div>
      <div className="ad-flip-face ad-flip-back" aria-hidden={!flipped}><AdTile ad={back} href={safeHref(back.url)} /></div>
    </div>
  </div>;
}
