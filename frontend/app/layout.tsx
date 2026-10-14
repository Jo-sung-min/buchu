import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import { SavedProvider } from "@/components/saved-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "부추 — 부업을 추천하다", template: "%s | 부추" },
  description: "좋아하는 걸 나누고, 부수입의 싹을 틔워요. 쿠팡 파트너스처럼 링크로 시작하는 제휴마케팅 부업을 부추에서 찾아보세요.",
  applicationName: "부추",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><SavedProvider><a className="skip-link" href="#main">본문 바로가기</a><Header /><main id="main">{children}</main><Footer /></SavedProvider></body></html>;
}
