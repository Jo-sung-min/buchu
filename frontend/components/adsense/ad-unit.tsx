"use client";
import { useEffect, useRef } from "react";
import { adsenseClient, adsenseEnabled, adsenseFeedLayoutKey, adsensePreview, adsenseSlots, type AdKind } from "@/lib/adsense";

declare global { interface Window { adsbygoogle?: unknown[] } }

const kindLabels: Record<AdKind, string> = { feed: "피드 광고 · 가로형", rect: "사이드 광고 · 300×250", article: "본문 광고 · 반응형" };

/**
 * One AdSense unit. It is requested only when it scrolls near the viewport (Blind-style lazy in-feed ads),
 * so a long page never fires every slot at once, and it reserves height so the content doesn't jump.
 */
export function AdUnit({ kind, as: Tag = "div", className = "" }: { kind: AdKind; as?: "div" | "li"; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    const ins = ref.current;
    if (!adsenseEnabled || !ins || requested.current) return;
    const request = () => {
      if (requested.current || ins.getAttribute("data-adsbygoogle-status")) return;
      requested.current = true;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker: leave the slot empty */ }
    };
    if (!("IntersectionObserver" in window)) { request(); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { request(); observer.disconnect(); } }, { rootMargin: "320px 0px" });
    observer.observe(ins);
    return () => observer.disconnect();
  }, []);

  if (!adsenseEnabled && !adsensePreview) return null;
  const native = kind === "feed" && adsenseFeedLayoutKey;
  return <Tag className={`adsense adsense-${kind} ${className}`.trim()} aria-label="광고">
    <span className="adsense-label" aria-hidden="true">AD</span>
    {adsenseEnabled ? <ins ref={ref} className="adsbygoogle" data-ad-client={adsenseClient} data-ad-slot={adsenseSlots[kind] || undefined}
      data-ad-format={native ? "fluid" : kind === "rect" ? "rectangle" : "auto"} data-ad-layout-key={native ? adsenseFeedLayoutKey : undefined}
      data-full-width-responsive={kind === "rect" || native ? undefined : "true"} />
      : <div className="adsense-preview" role="note"><strong>{kindLabels[kind]}</strong><span>NEXT_PUBLIC_ADSENSE_CLIENT을 설정하면 이 자리에 애드센스 광고가 나와요</span></div>}
  </Tag>;
}
