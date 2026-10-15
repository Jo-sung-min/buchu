import type { Metadata } from "next";
import { ThemeSettings } from "@/components/theme-settings";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return <div className="container settings-page">
    <div className="settings-heading"><h1>설정</h1></div>
    <ThemeSettings />
  </div>;
}
