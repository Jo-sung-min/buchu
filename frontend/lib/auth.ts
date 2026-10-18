import { api } from "./submissions";

export type Member = { id: string; username: string; nickname: string };
export type SessionResponse = { authenticated: boolean; member: Member | null };
export const memberChangedEvent = "buchu:member-changed";

export function fetchMe(signal?: AbortSignal) {
  return api<SessionResponse>("/api/auth/me", { signal });
}

export function login(username: string, password: string) {
  return api<SessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function register(username: string, password: string, nickname: string) {
  return api<SessionResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, nickname }) });
}

export function logout() {
  return api<SessionResponse>("/api/auth/logout", { method: "POST" });
}

export function announceMemberChange() {
  window.dispatchEvent(new Event(memberChangedEvent));
}
