"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function SiteFrame({ children, leftAd, rightAd, hasLeftAd, hasRightAd }: {
  children: ReactNode;
  leftAd: ReactNode;
  rightAd: ReactNode;
  hasLeftAd: boolean;
  hasRightAd: boolean;
}) {
  const pathname = usePathname();
  const focusedPage = pathname.startsWith("/admin") || pathname === "/settings" || pathname.startsWith("/classroom") || pathname.startsWith("/payments") || pathname.endsWith("/checkout");
  const showAds = !focusedPage && (hasLeftAd || hasRightAd);

  return <div className={`site-frame${showAds ? " site-frame-with-ads" : ""}`}>
    <main id="main" className="site-content">{children}</main>
    {showAds && hasLeftAd && <aside className="site-ad-rail site-ad-left" aria-label="왼쪽 광고">{leftAd}</aside>}
    {showAds && hasRightAd && <aside className="site-ad-rail site-ad-right" aria-label="오른쪽 광고">{rightAd}</aside>}
  </div>;
}
