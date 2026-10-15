import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import { SavedProvider } from "@/components/saved-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFrame } from "@/components/site-frame";
import { AdSlot } from "@/components/ad-slot";
import { isAdvertisementEnabled } from "@/lib/advertisements";
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

export const metadata: Metadata = {
  title: { default: "부추 — 부업 정보와 익명 후기", template: "%s | 부추" },
  description: "부업 정보와 익명 후기, 기업의 협업 기회부터 부업 전용 클래스까지. 내 시간과 초기 비용에 맞는 부업을 부추에서 시작하세요.",
  applicationName: "부추",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" data-theme="light" suppressHydrationWarning><head><script id="buchu-theme" dangerouslySetInnerHTML={{ __html: `(function(){var theme="light";try{if(localStorage.getItem("buchu:theme:v1")==="dark")theme="dark";}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();` }} /></head><body><ThemeProvider><SavedProvider><a className="skip-link" href="#main">본문 바로가기</a><Header /><SiteFrame leftAd={<AdSlot position="left" />} rightAd={<AdSlot position="right" />} hasLeftAd={isAdvertisementEnabled("left")} hasRightAd={isAdvertisementEnabled("right")}>{children}</SiteFrame><Footer /></SavedProvider></ThemeProvider></body></html>;
}
