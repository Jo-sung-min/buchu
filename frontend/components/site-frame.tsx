"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { adTotalSlots, fetchAdBoard, splitAds, type PublicAd } from "@/lib/ads";
import { AdRail } from "./ad-rail";

export function SiteFrame({ children, leftAd, rightAd }: {
  children: ReactNode;
  leftAd: ReactNode;
  rightAd: ReactNode;
}) {
  const pathname = usePathname();
  const focusedPage = pathname.startsWith("/admin") || pathname === "/settings" || pathname.startsWith("/classroom") || pathname.startsWith("/payments") || pathname.endsWith("/checkout");
  const [ads, setAds] = useState<PublicAd[] | null>(null);
  useEffect(() => {
    if (focusedPage) return;
    const controller = new AbortController();
    fetchAdBoard(controller.signal).then(board => setAds(board.items)).catch(() => { if (!controller.signal.aborted) setAds([]); });
    return () => controller.abort();
  }, [focusedPage]);
  const { left, right } = splitAds(ads || []);
  const remaining = Math.max(0, adTotalSlots - (ads?.length || 0));

  return <div className={`site-frame${focusedPage ? "" : " site-frame-with-ads"}`}>
    <main id="main" className="site-content">{children}</main>
    {!focusedPage && <aside className="site-ad-rail site-ad-left" aria-label="왼쪽 스폰서"><AdRail side="left" items={left} remaining={remaining} loaded={ads !== null} banner={leftAd} /></aside>}
    {!focusedPage && <aside className="site-ad-rail site-ad-right" aria-label="오른쪽 스폰서"><AdRail side="right" items={right} remaining={remaining} loaded={ads !== null} banner={rightAd} /></aside>}
  </div>;
}
