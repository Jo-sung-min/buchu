import "server-only";
import catalog from "../../data/advertisements.json";

export type AdvertisementPosition = "left" | "right";

export interface AdvertisementConfig {
  enabled: boolean;
  imageUrl: string;
  href: string;
  advertiser: string;
  alt: string;
}

const advertisements: Record<AdvertisementPosition, AdvertisementConfig> = catalog;

function safeAdvertisementUrl(value: string): string | null {
  const url = value.trim();
  // Browsers normalize backslashes and control characters before navigation.
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return null;
  if (url.startsWith("/")) return url.startsWith("//") ? null : url;

  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function isAdvertisementEnabled(position: AdvertisementPosition): boolean {
  return advertisements[position].enabled;
}

export function getAdvertisement(position: AdvertisementPosition) {
  const advertisement = advertisements[position];
  return {
    ...advertisement,
    imageUrl: safeAdvertisementUrl(advertisement.imageUrl),
    href: safeAdvertisementUrl(advertisement.href),
    advertiser: advertisement.advertiser.trim(),
    alt: advertisement.alt.trim(),
  };
}
