"use client";
import type { CSSProperties, ReactNode } from "react";
import { faviconFor, safeImageUrl, type PublicAd } from "@/lib/ads";

type TileAd = Pick<PublicAd, "siteName" | "tagline" | "url" | "color" | "imageUrl" | "iconUrl">;

/** One sponsor card: background image (or the brand colour), the site's favicon, name and tagline. */
export function AdTile({ ad, href, className = "" }: { ad: TileAd; href?: string | null; className?: string }) {
  const image = safeImageUrl(ad.imageUrl);
  const icon = safeImageUrl(ad.iconUrl) || faviconFor(ad.url);
  const initials = ad.siteName.trim().slice(0, 2) || "AD";
  const style = { "--tile-color": ad.color || "#25262B", ...(image ? { "--tile-image": `url("${image}")` } : {}) } as CSSProperties;
  const body: ReactNode = <>
    <span className="ad-tile-icon" aria-hidden="true">{icon ? <img src={icon} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}<span className="ad-tile-initials">{initials}</span></span>
    <strong>{ad.siteName || "사이트 이름"}</strong>
    <p>{ad.tagline || "한 줄 소개가 여기에 보여요"}</p>
  </>;
  return <div className={`ad-tile${image ? " has-image" : ""} ${className}`.trim()} style={style}>
    {href ? <a href={href} target="_blank" rel="sponsored noopener noreferrer" aria-label={`${ad.siteName} 바로가기 (새 창)`}>{body}</a> : <div>{body}</div>}
  </div>;
}
