import Link from "next/link";
import { Icon } from "./icons";

export function GuideBanner() {
  return <section className="container"><div className="guide-banner"><div className="guide-illustration" aria-hidden="true"><Icon name="book" size={36} /><span>01</span></div><div><span className="section-kicker">YOUR FIRST STEP</span><h2>처음이라도 괜찮아요.</h2><p>링크 만들기부터 첫 추천까지, 부추가 차근차근 알려드릴게요.</p></div><Link href="/guide" className="button button-white">시작 가이드 읽기 <Icon name="arrow" size={17} /></Link></div></section>;
}
