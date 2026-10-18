import { api } from "./submissions";

export type PostCategory = "FREE" | "QUESTION" | "TIP" | "INCOME";
export const postCategories: [PostCategory, string][] = [["FREE", "자유"], ["QUESTION", "질문"], ["TIP", "꿀팁"], ["INCOME", "수익 인증"]];
export const postCategoryLabels: Record<PostCategory, string> = Object.fromEntries(postCategories) as Record<PostCategory, string>;
export type PostSort = "latest" | "popular" | "comments";

export type Post = {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  nickname: string;
  viewCount: number;
  commentCount: number;
  createdAt: string;
};
export type PostComment = { id: string; postId: string; content: string; nickname: string; createdAt: string };
export type PostPage = { items: Post[]; total: number; page: number; size: number };
export type PostInput = { category: PostCategory; title: string; content: string };

const storageKey = "buchu:post-delete-tokens:v1";
const sessionTokens: Record<string, string> = {};
export const postsChangedEvent = "buchu:posts-changed";

export function getPostToken(id: string): string | undefined {
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

export function rememberPostToken(id: string, token: string): boolean {
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

export function forgetPostToken(id: string): void {
  delete sessionTokens[id];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      delete (saved as Record<string, unknown>)[id];
      localStorage.setItem(storageKey, JSON.stringify(saved));
    }
  } catch { /* The in-memory token has already been removed. */ }
}

export function announcePostChange(): void {
  window.dispatchEvent(new Event(postsChangedEvent));
}

export function fetchPosts({ category, sort = "latest", q, page = 0, size = 20, signal }: {
  category?: PostCategory | ""; sort?: PostSort; q?: string; page?: number; size?: number; signal?: AbortSignal;
} = {}) {
  const query = new URLSearchParams({ sort, page: String(page), size: String(size) });
  if (category) query.set("category", category);
  if (q?.trim()) query.set("q", q.trim());
  return api<PostPage>(`/api/posts?${query}`, { signal });
}

export function fetchPost(id: string, signal?: AbortSignal) {
  return api<Post>(`/api/posts/${encodeURIComponent(id)}`, { signal });
}

export function fetchComments(id: string, signal?: AbortSignal) {
  return api<PostComment[]>(`/api/posts/${encodeURIComponent(id)}/comments`, { signal });
}

export function writePost(input: PostInput) {
  return api<{ post: Post; deleteToken: string }>("/api/posts", { method: "POST", body: JSON.stringify(input) });
}

export function writeComment(postId: string, content: string) {
  return api<{ comment: PostComment; deleteToken: string }>(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ content }) });
}

export async function deletePost(id: string, token: string): Promise<void> {
  await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Post-Token": token } });
  forgetPostToken(id);
  announcePostChange();
}

export async function deleteComment(id: string, token: string): Promise<void> {
  await api(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Post-Token": token } });
  forgetPostToken(id);
  announcePostChange();
}

export function postTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}일 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(date);
}

export function postDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date);
}
