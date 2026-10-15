"use client";

import { Icon } from "./icons";
import { useTheme } from "./theme-provider";

const OPTIONS = [
  { value: "light", label: "화이트", icon: "sun" },
  { value: "dark", label: "블랙", icon: "moon" },
] as const;

export function ThemeSettings() {
  const { theme, ready, storageAvailable, setTheme } = useTheme();

  return <section className="settings-panel" aria-labelledby="theme-heading">
    <h2 id="theme-heading">화면 모드</h2>
    <fieldset className="theme-options" aria-labelledby="theme-heading" disabled={!ready}>
      {OPTIONS.map((option) => <label key={option.value} className={`theme-option${theme === option.value ? " is-selected" : ""}`}>
        <span className="theme-option-copy"><Icon name={option.icon} size={21} /><strong>{option.label}</strong><input type="radio" name="theme" value={option.value} checked={theme === option.value} onChange={() => setTheme(option.value)} aria-label={`${option.label} 모드`} /></span>
      </label>)}
    </fieldset>
    {(!storageAvailable || !ready) && <p className="theme-setting-status" role="status" aria-live="polite">{!storageAvailable ? "브라우저에 저장할 수 없어 다음 방문에는 설정이 유지되지 않을 수 있어요." : "설정 불러오는 중…"}</p>}
  </section>;
}
