import { getAdvertisement, type AdvertisementPosition } from "@/lib/advertisements";

export function AdSlot({ position }: { position: AdvertisementPosition }) {
  const advertisement = getAdvertisement(position);
  if (!advertisement.enabled) return null;

  const alt = advertisement.alt || (advertisement.advertiser ? `${advertisement.advertiser} 광고` : "광고 배너");
  const creative = advertisement.imageUrl ? (
    <img
      className="ad-slot-image"
      src={advertisement.imageUrl}
      width={160}
      height={600}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  ) : null;

  return (
    <div className="ad-slot" data-position={position}>
      <span className="ad-slot-label">광고</span>
      {creative ? (
        advertisement.href ? (
          <a
            className="ad-slot-link"
            href={advertisement.href}
            target="_blank"
            rel="sponsored noopener noreferrer"
            aria-label={`${advertisement.advertiser || "광고"} 자세히 보기 (새 창)`}
          >
            {creative}
          </a>
        ) : creative
      ) : (
        <div className="ad-slot-placeholder">
          <span className="ad-slot-mark" aria-hidden="true">AD</span>
        </div>
      )}
    </div>
  );
}
