export type RichDocument = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichDocument[];
};

export type SubmissionStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
export type SubmissionChannel = "blog" | "sns" | "video" | "website";
export type SubmissionBoard = "MARKETER" | "HELP";
export type HelpType = "PROMOTION" | "RECRUITMENT";
export const submissionBoardLabels: Record<SubmissionBoard, string> = { MARKETER: "부업 정보", HELP: "기업 홍보" };
export const helpTypeLabels: Record<HelpType, string> = { PROMOTION: "홍보 · 마케팅", RECRUITMENT: "인재 · 협업 모집" };

export type SubmissionInput = {
  board: SubmissionBoard;
  helpType: HelpType;
  location: string;
  deadline: string | null;
  companyName: string;
  businessNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  name: string;
  tagline: string;
  description: string;
  officialUrl: string;
  category: import("./types").ProgramCategory;
  channels: SubmissionChannel[];
  cost: "free" | "check";
  costLabel: string;
  commission: string;
  settlement: string;
  thumbnailUploadId: string | null;
  content: RichDocument;
  tags: string[];
};

export type Submission = SubmissionInput & {
  id: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  publishedSlug: string | null;
  thumbnailUrl?: string | null;
};

export type DraftCredentials = { id: string; accessToken: string };
export type UploadedImage = { uploadId: string; objectKey: string; url: string; contentType: string; size: number };

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * One CSRF lookup at a time. The token lives in the session, and two lookups racing before the session cookie exists
 * would each start a session of their own, so one of the two requests that follow would carry the wrong token.
 */
let csrfLookup: Promise<{ token: string; headerName: string }> | null = null;
function csrfToken() {
  if (!csrfLookup) {
    csrfLookup = (async () => {
      const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new ApiError("보안 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.", response.status);
      return await response.json() as { token: string; headerName: string };
    })();
    csrfLookup.finally(() => { csrfLookup = null; }).catch(() => undefined);
  }
  return csrfLookup;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = await csrfToken();
      headers.set(csrf.headerName, csrf.token);
    }
    const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
    const text = await response.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
    if (!response.ok) {
      const error = body as { message?: string; detail?: string } | undefined;
      throw new ApiError(error?.message || error?.detail || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", response.status, body);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.", 0);
  }
}

export function submissionHeaders(credentials: DraftCredentials): Record<string, string> {
  return { "X-Submission-Token": credentials.accessToken };
}

export const submissionStatusLabel: Record<SubmissionStatus, string> = {
  DRAFT: "작성 중", PENDING: "검토 중", APPROVED: "승인 · 게시 완료", REJECTED: "보완 후 재신청",
};

export const emptySubmission: SubmissionInput = {
  board: "MARKETER", helpType: "PROMOTION", location: "", deadline: null,
  companyName: "", businessNumber: "", contactName: "", contactEmail: "", contactPhone: "",
  name: "", tagline: "", description: "", officialUrl: "", category: "affiliate", channels: [],
  cost: "check", costLabel: "조건 확인 필요", commission: "", settlement: "", thumbnailUploadId: null,
  content: { type: "doc", content: [{ type: "paragraph" }] }, tags: [],
};

export function editableSubmission(submission: Submission): SubmissionInput {
  return Object.fromEntries(Object.keys(emptySubmission).map((key) => [key, submission[key as keyof SubmissionInput] ?? emptySubmission[key as keyof SubmissionInput]])) as SubmissionInput;
}

export function richText(document: RichDocument): string {
  return document.text ?? document.content?.map(richText).join(" ") ?? "";
}

export async function uploadImage(credentials: DraftCredentials, file: File): Promise<UploadedImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG, WebP 이미지만 등록할 수 있어요.");
  if (file.size > 8 * 1024 * 1024 || file.size === 0) throw new Error("이미지는 0바이트보다 크고 8MB 이하여야 해요.");
  const base = `/api/submissions/${encodeURIComponent(credentials.id)}`;
  const signed = await api<{ uploadId: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> }>(`${base}/uploads/presign`, {
    method: "POST", headers: submissionHeaders(credentials), body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  let uploaded: Response;
  try {
    uploaded = await fetch(signed.uploadUrl, { method: signed.method, headers: signed.headers, body: file, credentials: "omit" });
  } catch {
    throw new Error("이미지 전송에 실패했어요. 연결 상태를 확인한 뒤 다시 등록해 주세요.");
  }
  if (!uploaded.ok) throw new Error("이미지를 저장하지 못했어요. 같은 파일을 다시 등록해 주세요.");
  return api<UploadedImage>(`${base}/uploads/${encodeURIComponent(signed.uploadId)}/complete`, { method: "POST", headers: submissionHeaders(credentials) });
}
