import { api } from "./submissions";
import type { AgeGroup } from "./types";

export type Member = { id: string; username: string; nickname: string; ageGroup: AgeGroup | null };
export type SessionResponse = { authenticated: boolean; member: Member | null };
export const memberChangedEvent = "buchu:member-changed";

export function fetchMe(signal?: AbortSignal) {
  return api<SessionResponse>("/api/auth/me", { signal });
}

export function login(username: string, password: string) {
  return api<SessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function register(username: string, password: string, nickname: string, ageGroup: AgeGroup | null = null) {
  return api<SessionResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, nickname, ageGroup }) });
}

export function updateProfile(ageGroup: AgeGroup | null) {
  return api<SessionResponse>("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ ageGroup }) });
}

export function logout() {
  return api<SessionResponse>("/api/auth/logout", { method: "POST" });
}

export function announceMemberChange() {
  window.dispatchEvent(new Event(memberChangedEvent));
}
