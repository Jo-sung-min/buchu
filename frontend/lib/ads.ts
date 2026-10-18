import { api } from "./submissions";

export const adMonthlyPrice = 300_000;
export const adTotalSlots = 10;
export const adColors = ["#25262B", "#3A86FF", "#2BB673", "#F4A259", "#E95044", "#7B61FF", "#00B4D8", "#D4A017"];

export type PublicAd = { id: string; siteName: string; tagline: string; url: string; color: string };
export type AdBoard = { items: PublicAd[]; totalSlots: number; monthlyPriceKrw: number };
export type AdStatus = "PENDING" | "APPROVED" | "REJECTED" | "ENDED";
export type Advertisement = PublicAd & { contactEmail: string; status: AdStatus; note: string; createdAt: string; startsAt: string | null; endsAt: string | null };
export type AdminAdPage = { items: Advertisement[]; total: number; page: number; size: number; pending: number; active: number; totalSlots: number };
export type AdApplyInput = { siteName: string; tagline: string; url: string; contactEmail: string; color: string };
export const adStatusLabels: Record<AdStatus, string> = { PENDING: "입금·승인 대기", APPROVED: "게재 중", REJECTED: "거절", ENDED: "종료" };

export function fetchAdBoard(signal?: AbortSignal) {
  return api<AdBoard>("/api/ads", { signal });
}

export function applyAd(input: AdApplyInput) {
  return api<Advertisement>("/api/ads/apply", { method: "POST", body: JSON.stringify(input) });
}

export function krw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

/** Tiles alternate left/right so both rails fill evenly, and a sponsor keeps its side once placed. */
export function splitAds(items: PublicAd[]) {
  return { left: items.filter((_, index) => index % 2 === 0), right: items.filter((_, index) => index % 2 === 1) };
}
