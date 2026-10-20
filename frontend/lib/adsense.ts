/** Google AdSense settings. NEXT_PUBLIC_* values are inlined at build time, so each must be read by its full name. */
export const adsenseClient = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "").trim();
export const adsenseEnabled = /^ca-pub-\d{6,}$/.test(adsenseClient);
/** Without a publisher id the dev server draws labelled placeholders so the placements stay visible; production renders nothing. */
export const adsensePreview = !adsenseEnabled && process.env.NODE_ENV !== "production";

export type AdKind = "feed" | "rect" | "article";
export const adsenseSlots: Record<AdKind, string> = {
  feed: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED || "").trim(),
  rect: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || "").trim(),
  article: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE || "").trim(),
};
/** Optional: a native in-feed unit's layout key (data-ad-layout-key) so feed slots blend in with post rows. */
export const adsenseFeedLayoutKey = (process.env.NEXT_PUBLIC_ADSENSE_FEED_LAYOUT_KEY || "").trim();
export const adsenseScriptUrl = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`;
