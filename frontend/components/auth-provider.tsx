"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, logout as logoutRequest, memberChangedEvent, type Member } from "@/lib/auth";
import { announcePostChange } from "@/lib/posts";

type AuthState = { member: Member | null; ready: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthState>({ member: null, ready: false, refresh: async () => {}, logout: async () => {} });

/** The signed-in member, shared by the header, the write forms and the "내 글" controls. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try { const session = await fetchMe(); setMember(session.authenticated ? session.member : null); }
    catch { setMember(null); }
    finally { setReady(true); }
  }, []);
  useEffect(() => {
    void refresh();
    const sync = () => { void refresh(); };
    window.addEventListener(memberChangedEvent, sync);
    return () => window.removeEventListener(memberChangedEvent, sync);
  }, [refresh]);
  const logout = useCallback(async () => {
    try { await logoutRequest(); } finally { setMember(null); announcePostChange(); }
  }, []);
  return <AuthContext.Provider value={{ member, ready, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
