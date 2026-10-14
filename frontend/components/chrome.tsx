"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuchuMark, Icon } from "./icons";
import { useSaved } from "./saved-provider";

export function Header() {
  const pathname = usePathname();
  const { saved } = useSaved();
  return <header className="site-header"><div className="container header-inner">
    <Link href="/" className="brand" aria-label="부추 홈"><BuchuMark /><span>부추<span className="brand-period">.</span></span><span className="brand-caption">부업을 추천하다</span></Link>
    <nav className="main-nav" aria-label="주 메뉴"><Link href="/#discover" className={pathname === "/" || pathname.startsWith("/programs") ? "nav-active" : ""}>모두가 마케터<span className="nav-dot" /></Link><Link href="/guide" className={pathname === "/guide" ? "nav-active" : ""}>시작 가이드</Link></nav>
    <Link href="/saved" className={`saved-link ${pathname === "/saved" ? "is-active" : ""}`}><Icon name="bookmark" size={18} /><span>관심 부업</span><span className="saved-count">{saved.length}</span></Link>
  </div></header>;
}
export function Footer() {
  return <footer className="site-footer"><div className="container"><div className="footer-top"><Link href="/" className="brand"><BuchuMark size={28} /><span>부추.</span></Link><p>당신의 가능성이 자라는 곳.</p><Link href="/guide">처음 시작하는 분께 <Icon name="arrow-up" size={16} /></Link></div><div className="footer-bottom"><p>부추는 부업 정보를 소개하는 사이트입니다. 가입·활동·정산은 각 서비스에서 진행됩니다.<br />수익은 활동과 승인 조건에 따라 달라지며, 참여 전 공식 정책을 확인해 주세요.</p><span>© {new Date().getFullYear()} BUCHU</span></div></div></footer>;
}
