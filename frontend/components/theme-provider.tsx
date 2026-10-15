"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "buchu:theme:v1";
const ThemeContext = createContext<{
  theme: Theme;
  ready: boolean;
  storageAvailable: boolean;
  setTheme: (theme: Theme) => void;
}>({ theme: "light", ready: false, storageAvailable: true, setTheme: () => {} });

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let initial: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    try {
      initial = localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      setStorageAvailable(false);
    }
    applyTheme(initial);
    updateTheme(initial);
    setReady(true);

    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next: Theme = event.newValue === "dark" ? "dark" : "light";
      applyTheme(next);
      updateTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function setTheme(next: Theme) {
    applyTheme(next);
    updateTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }

  return <ThemeContext.Provider value={{ theme, ready, storageAvailable, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
