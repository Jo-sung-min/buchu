import { api } from "./submissions";

export type Review = {
  id: string;
  programSlug: string;
  programName: string;
  rating: number;
  title: string;
  content: string;
  nickname: string;
  createdAt: string;
};

export type ReviewPage = { items: Review[]; total: number; page: number; size: number };
export type ReviewSummary = {
  totalReviews: number;
  averageRating: number | null;
  programs: { programSlug: string; reviewCount: number; averageRating: number | null }[];
};
export type ReviewInput = { rating: number; title: string; content: string };
export type ReviewProgram = { slug: string; name: string };
export type ReviewSort = "latest" | "rating_desc";

const storageKey = "buchu:review-delete-tokens:v1";
const sessionTokens: Record<string, string> = {};
export const reviewsChangedEvent = "buchu:reviews-changed";

export function getReviewToken(id: string): string | undefined {
  if (sessionTokens[id]) return sessionTokens[id];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>)[id];
      return typeof value === "string" ? value : undefined;
    }
  } catch { /* A user may disable browser storage. */ }
  return undefined;
}

export function rememberReviewToken(id: string, token: string): boolean {
  sessionTokens[id] = token;
  try {
    let saved: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        saved = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      }
    } catch { /* Replace malformed local data with the new token. */ }
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, [id]: token }));
    return true;
  } catch { return false; }
}

export function forgetReviewToken(id: string): void {
  delete sessionTokens[id];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      delete (saved as Record<string, unknown>)[id];
      localStorage.setItem(storageKey, JSON.stringify(saved));
    }
  } catch { /* The in-memory token has already been removed. */ }
}

export function announceReviewChange(): void {
  window.dispatchEvent(new Event(reviewsChangedEvent));
}

export function fetchReviews({ programSlug, sort = "latest", page = 0, size = 10, signal }: {
  programSlug?: string; sort?: ReviewSort; page?: number; size?: number; signal?: AbortSignal;
} = {}) {
  const query = new URLSearchParams({ sort, page: String(page), size: String(size) });
  if (programSlug) query.set("programSlug", programSlug);
  return api<ReviewPage>(`/api/reviews?${query}`, { signal });
}

export function fetchReviewSummary(signal?: AbortSignal) {
  return api<ReviewSummary>("/api/reviews/summary", { signal });
}

export function writeReview(programSlug: string, input: ReviewInput) {
  return api<{ review: Review; deleteToken: string }>(`/api/programs/${encodeURIComponent(programSlug)}/reviews`, {
    method: "POST", body: JSON.stringify(input),
  });
}

export async function deleteReview(id: string, token: string): Promise<void> {
  await api(`/api/reviews/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Review-Token": token } });
  forgetReviewToken(id);
  announceReviewChange();
}

export function reviewDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(date);
}
