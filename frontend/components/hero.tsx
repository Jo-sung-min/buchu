import Link from "next/link";
import { Icon } from "./icons";

function HeroArtwork() {
  return <div className="hero-art" aria-hidden="true">
    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span><span className="art-dot" />
    <div className="floating-note note-share"><span className="note-icon"><Icon name="link" size={23} /></span><div><small>내가 좋아하는 것</small><strong>링크 하나로 공유하기</strong></div><span className="note-check"><Icon name="check" size={15} /></span></div>
    <svg className="sprout-art" viewBox="0 0 350 350" fill="none"><ellipse cx="178" cy="308" rx="106" ry="17" fill="#dce6ce" /><path d="M179 269c-59-12-115-89-109-166 67 24 106 92 109 166Z" fill="#759947" /><path d="M180 267C142 188 152 68 208 25c38 85 26 173-28 242Z" fill="#346647" /><path d="M181 270c0-73 46-137 111-147 4 71-44 132-111 147Z" fill="#a4b977" /><path d="M178 278c-1-54-24-105-62-141M182 278c4-77 10-149 22-214M186 275c24-50 54-91 90-129" stroke="#e7efda" strokeWidth="2.5" strokeLinecap="round" opacity=".55" /><path d="M126 240h107l-14 58c-3 13-18 20-39 20s-35-7-38-20l-16-58Z" fill="#f6f0dd" /><ellipse cx="179.5" cy="240" rx="53.5" ry="12" fill="#e9dfc1" /><path d="M146 256c23 6 47 7 69 0" stroke="#ded1ac" strokeWidth="2" /><circle cx="166" cy="277" r="3" fill="#456547" /><circle cx="193" cy="277" r="3" fill="#456547" /><path d="M174 287c4 4 9 4 13 0" stroke="#456547" strokeWidth="2" strokeLinecap="round" /></svg>
    <div className="floating-note note-grow"><span className="grow-icon"><Icon name="leaf" size={20} /></span><div><small>작은 추천이 쌓이면</small><strong>나만의 가능성도 쑥쑥</strong></div></div>
    <div className="art-label">GROW YOUR POSSIBILITIES</div>
  </div>;
}

export function Hero() {
  return <section className="hero"><div className="container hero-inner"><div className="hero-copy"><div className="eyebrow"><span />작은 시작, 새로운 가능성</div><h1>좋아하는 걸 나누고,<br /><span>부수입의 싹</span>을 틔워요.</h1><p>내 취향으로 고른 상품, 정성 들여 쓴 추천 한 줄.<br />일상 속 작은 추천을 부업으로 연결해 보세요.</p><a href="#discover" className="button button-green">나에게 맞는 부업 찾기 <Icon name="arrow" size={18} /></a><div className="hero-footnote"><span className="mini-leaves">✳</span>시작이 막막할 땐, 부추와 함께.</div></div><HeroArtwork /></div></section>;
}
export function IntroStrip() {
  return <div className="container"><div className="intro-strip"><div className="intro-icon"><Icon name="link" size={22} /></div><div><strong>모두가 마케터</strong><p>나의 추천이 누군가의 선택이 되는 일. 제휴마케팅부터 시작해요.</p></div><Link href="/guide">제휴마케팅이 처음이라면 <Icon name="arrow" size={16} /></Link></div></div>;
}
