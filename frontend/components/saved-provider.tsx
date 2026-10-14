"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "buchu:saved:v1";
const SavedContext = createContext<{ saved: string[]; ready: boolean; toggle: (slug: string) => void }>({ saved: [], ready: false, toggle: () => {} });
function readSaved(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? [...new Set(data.filter((value): value is string => typeof value === "string"))] : [];
  } catch { return []; }
}
export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSaved(readSaved()); setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) setSaved(readSaved()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2600);
    return () => clearTimeout(timer);
  }, [message]);
  function toggle(slug: string) {
    const next = saved.includes(slug) ? saved.filter((value) => value !== slug) : [...saved, slug];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setMessage(next.includes(slug) ? "관심 부업에 저장했어요." : "관심 부업에서 삭제했어요.");
    } catch { setMessage("저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요."); }
  }
  return <SavedContext.Provider value={{ saved, ready, toggle }}>{children}<div className={`toast ${message ? "toast-visible" : ""}`} role="status">{message}</div></SavedContext.Provider>;
}
export const useSaved = () => useContext(SavedContext);
