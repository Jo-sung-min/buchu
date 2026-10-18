"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuchuMark, Icon } from "./icons";
import { useSaved } from "./saved-provider";

export function Header() {
  const pathname = usePathname();
  const help = pathname.startsWith("/help");
  const courses = pathname.startsWith("/courses") || pathname.startsWith("/classroom") || pathname.startsWith("/payments");
  const programs = pathname.startsWith("/programs") || pathname.startsWith("/reviews") || pathname.startsWith("/saved");
  const { saved } = useSaved();
  const searchAction = courses ? "/courses" : help ? "/help" : programs ? "/programs" : "/";
  return <><header className="community-header"><div className="container community-header-inner">
      <Link href="/" className="community-brand" aria-label="부추 홈"><BuchuMark size={30} /><span>부추<span>.</span></span></Link>
      <nav className="community-nav" aria-label="주 메뉴"><Link href="/programs" aria-current={programs ? "page" : undefined}>부업 정보</Link><Link href="/help" aria-current={help ? "page" : undefined}>기업 홍보</Link><Link href="/courses" aria-current={courses ? "page" : undefined}>부업 클래스</Link></nav>
      <form className="community-header-search" action={searchAction}><Icon name="search" size={17} /><input name="q" aria-label={courses ? "강의 검색" : programs ? "부업 검색" : help ? "기업 홍보 검색" : "글 검색"} placeholder={courses ? "강의 검색" : programs ? "부업 검색" : help ? "기업 홍보 검색" : "글 검색"} maxLength={120} /><button aria-label="검색" type="submit"><Icon name="arrow" size={17} /></button></form>
      <div className="community-header-actions"><Link href="/saved" className="community-saved" aria-label={`관심 부업 ${saved.length}개`}><Icon name="bookmark" size={20} /><span>관심 부업</span>{saved.length > 0 && <b>{saved.length > 99 ? "99+" : saved.length}</b>}</Link><Link href="/settings" className="community-settings" aria-label="설정" title="설정" aria-current={pathname === "/settings" ? "page" : undefined}><Icon name="settings" size={20} /></Link><Link href={courses ? "/classroom" : help ? "/partners/apply?board=HELP" : programs ? "/reviews/write" : "/community/write"} className="community-write">{courses ? "내 강의실" : help ? "기업 글쓰기" : programs ? "후기 쓰기" : "글쓰기"}</Link></div>
    </div></header></>;
}
export function Footer() {
  return <footer className="community-footer"><div className="container"><div className="community-footer-links"><Link href="/" className="community-brand"><BuchuMark size={23} /><span>부추.</span></Link><Link href="/community">전체 글</Link><Link href="/programs">부업 정보</Link><Link href="/help">기업 홍보</Link><Link href="/courses">부업 클래스</Link><Link href="/guide">이용 가이드</Link><Link href="/partners/apply">기업 게재 신청</Link><Link href="/settings">설정</Link><Link href="/admin">관리자</Link></div><span>© {new Date().getFullYear()} BUCHU. All rights reserved.</span></div></footer>;
}
