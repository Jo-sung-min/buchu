import { api } from "./submissions";

export type PostCategory = "FREE" | "INCOME" | "QUESTION" | "TIP" | "STOCK" | "REALTY" | "WORK" | "LOVE" | "HEALTH" | "STORY";
/** Front-page order. The first four are about side jobs; the rest are the everyday topics people actually talk about. */
export const postCategories: [PostCategory, string][] = [
  ["FREE", "부업 수다"], ["INCOME", "수익 인증"], ["QUESTION", "질문"], ["TIP", "꿀팁"],
  ["STOCK", "주식·투자"], ["REALTY", "부동산"], ["WORK", "직장인 고민"], ["LOVE", "결혼·연애"], ["HEALTH", "헬스·다이어트"], ["STORY", "썰·유머"],
];
export const postCategoryLabels: Record<PostCategory, string> = Object.fromEntries(postCategories) as Record<PostCategory, string>;
export const postCategoryDescriptions: Record<PostCategory, string> = {
  FREE: "부업하며 드는 생각, 가볍게 떠들어요", INCOME: "이번 달 얼마 벌었는지 솔직하게", QUESTION: "막히는 부분, 먼저 해본 사람에게", TIP: "써먹을 수 있는 노하우",
  STOCK: "오늘 장은 어땠나요", REALTY: "청약, 전세, 내 집 마련 이야기", WORK: "회사에서 있었던 일, 이직 고민", LOVE: "연애, 결혼 준비, 신혼 이야기", HEALTH: "운동, 식단, 몸 만들기", STORY: "웃긴 썰, 황당한 경험담",
};
export function isPostCategory(value: string | undefined): value is PostCategory {
  return Boolean(value) && value! in postCategoryLabels;
}
export type HomeFeed = { popular: Post[]; latest: Post[]; byCategory: Partial<Record<PostCategory, Post[]>>; total: number };
export type PostSort = "latest" | "popular" | "comments";

export type AuthorType = "MEMBER" | "ANON";
type Authored = { nickname: string; authorType: AuthorType; ipHint: string | null; mine: boolean };
/** A photo attached to a post: the upload id and the address it is served from (CDN or `/api/media/...`). */
export type PostImage = { id: string; url: string };
export type Post = Authored & {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  images: PostImage[];
  viewCount: number;
  commentCount: number;
  createdAt: string;
};
export type PostComment = Authored & { id: string; postId: string; content: string; createdAt: string };
/** An uploaded photo the form has not yet attached: the upload id plus the secret presign handed out. */
export type PostImageRef = { uploadId: string; token: string };
export const postImageLimit = 5;
export const postImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const postImageMaxBytes = 8 * 1024 * 1024;

/** DC-style byline: members show their nickname, visitors show "ㅇㅇ(118.235)". */
export function authorLabel(item: Pick<Authored, "nickname" | "authorType" | "ipHint">) {
  return item.authorType === "ANON" && item.ipHint ? `${item.nickname}(${item.ipHint})` : item.nickname;
}
export function authorInitial(item: Pick<Authored, "nickname" | "authorType">) {
  return item.authorType === "MEMBER" ? item.nickname.trim().charAt(0) || "회" : "ㅇ";
}
export type PostPage = { items: Post[]; total: number; page: number; size: number };
export type PostInput = { category: PostCategory; title: string; content: string; images: PostImageRef[] };

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

export function fetchHomeFeed(signal?: AbortSignal) {
  return api<HomeFeed>("/api/posts/home", { signal });
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

/**
 * Uploads one photo for a post the same way the submission form does: ask the API for a signed PUT address, send the
 * file there directly (S3 or the local store), then confirm so the server verifies the bytes. Progress is the PUT's.
 */
export async function uploadPostImage(file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<PostImageRef> {
  if (!postImageTypes.includes(file.type)) throw new Error("JPG, PNG, WebP, GIF 사진만 올릴 수 있어요.");
  if (file.size > postImageMaxBytes || file.size === 0) throw new Error("사진은 0바이트보다 크고 8MB 이하여야 해요.");
  const signed = await api<{ uploadId: string; uploadUrl: string; method: "PUT"; headers: Record<string, string>; uploadToken: string }>("/api/posts/uploads/presign", {
    method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }), signal,
  });
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(signed.method, signed.uploadUrl);
    Object.entries(signed.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(event.loaded / event.total); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("사진을 저장하지 못했어요. 같은 파일을 다시 올려 주세요."));
    request.onerror = () => reject(new Error("사진 전송에 실패했어요. 연결 상태를 확인한 뒤 다시 올려 주세요."));
    request.onabort = () => reject(new DOMException("업로드를 취소했어요.", "AbortError"));
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
  await api(`/api/posts/uploads/${encodeURIComponent(signed.uploadId)}/complete`, { method: "POST", headers: { "X-Upload-Token": signed.uploadToken }, signal });
  return { uploadId: signed.uploadId, token: signed.uploadToken };
}

/** Drops a photo that was uploaded for a post but taken out of the draft before posting. Best effort: the server also tolerates leftovers. */
export function discardPostImage(ref: PostImageRef): Promise<void> {
  return api<void>(`/api/posts/uploads/${encodeURIComponent(ref.uploadId)}`, { method: "DELETE", headers: { "X-Upload-Token": ref.token } }).catch(() => undefined);
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
