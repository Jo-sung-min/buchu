import type { Metadata } from "next";
import Script from "next/script";
import { adsenseEnabled, adsenseScriptUrl } from "@/lib/adsense";
import { Header, Footer } from "@/components/chrome";
import { SavedProvider } from "@/components/saved-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFrame } from "@/components/site-frame";
import { AdSlot } from "@/components/ad-slot";
import "./globals.css";
import "./admin.css";
import "./submissions.css";
import "./reviews.css";
import "./community.css";
import "./theme.css";
import "./advertisements.css";
import "./controls.css";
import "./courses.css";
import "./course-admin.css";
import "./topic-layout.css";
import "./home.css";
import "./community-posts.css";
import "./programs.css";
import "./labor.css";
import "./adsense.css";

export const metadata: Metadata = {
  title: { default: "부추 — 부업하는 사람들의 소통 공간", template: "%s | 부추" },
  description: "부업 경험과 질문을 익명으로 나누는 커뮤니티. 부업 정보와 익명 후기, 기업 홍보, 부업 클래스까지 부추에서 시작하세요.",
  applicationName: "부추",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" data-theme="light" suppressHydrationWarning><head><script id="buchu-theme" dangerouslySetInnerHTML={{ __html: `(function(){var theme="light";try{if(localStorage.getItem("buchu:theme:v1")==="dark")theme="dark";}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();` }} /></head><body><ThemeProvider><AuthProvider><SavedProvider><a className="skip-link" href="#main">본문 바로가기</a><Header /><SiteFrame leftAd={<AdSlot position="left" />} rightAd={<AdSlot position="right" />}>{children}</SiteFrame><Footer /></SavedProvider></AuthProvider></ThemeProvider>{adsenseEnabled && <Script src={adsenseScriptUrl} strategy="afterInteractive" crossOrigin="anonymous" />}</body></html>;
}
