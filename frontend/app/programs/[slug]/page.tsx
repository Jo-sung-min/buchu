import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/programs";
import { channelLabels } from "@/lib/types";
import { BrandAvatar, SaveButton } from "@/components/program-card";
import { Icon } from "@/components/icons";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const program = await getProgram((await params).slug);
  return { title: program?.name || "부업을 찾을 수 없어요", description: program?.tagline };
}
export default async function ProgramPage({ params }: Props) {
  const program = await getProgram((await params).slug);
  if (!program) notFound();
  return <div className="container detail-page"><Link href="/#discover" className="back-link"><Icon name="arrow" size={16} />모두가 마케터로 돌아가기</Link><div className="detail-layout"><article><div className="detail-heading"><BrandAvatar program={program} large /><div><span className="section-kicker">모두가 마케터 · {program.category === "affiliate" ? "제휴마케팅" : "성과형 마케팅"}</span><h1>{program.name}</h1><p>{program.tagline}</p></div></div><div className="detail-tags">{program.tags.map(tag => <span key={tag}>{tag}</span>)}</div><section className="detail-section"><h2>어떤 서비스인가요?</h2><p>{program.description}</p><div className="highlight-list">{program.highlights.map(item => <div key={item}><span><Icon name="check" size={16} /></span>{item}</div>)}</div></section><section className="detail-section"><span className="section-kicker">STEP BY STEP</span><h2>이렇게 시작해 보세요</h2><ol className="step-list">{program.steps.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section><section className="caution-panel"><h2><Icon name="info" size={20} />시작 전에 꼭 확인해요</h2><ul>{program.cautions.map(caution => <li key={caution}>{caution}</li>)}</ul></section><div className="source-note"><Icon name="globe" size={16} /><div>공식 공개 정보 확인: {program.verifiedAt.replaceAll("-", ".")}<br /><a href={program.guideUrl} target="_blank" rel="noopener noreferrer">공식 안내에서 최신 조건 확인하기 ↗</a></div></div></article><aside className="detail-sidebar"><div className="summary-card"><span className="section-kicker">한눈에 살펴보기</span><h2>나에게 맞는 부업일까요?</h2><dl><div><dt>시작 비용</dt><dd>{program.costLabel}</dd></div><div><dt>활동 채널</dt><dd>{program.channels.map(channel => channelLabels[channel]).join(" · ")}</dd></div><div><dt>수익 방식</dt><dd>{program.commission}</dd></div><div><dt>정산 안내</dt><dd>{program.settlement}</dd></div></dl><a className="button button-green" href={program.officialUrl} target="_blank" rel="noopener noreferrer">공식 사이트 방문하기 <Icon name="arrow-up" size={18} /></a><SaveButton program={program} full /><p className="sidebar-note">새 창에서 공식 사이트로 이동합니다.<br />가입과 활동은 해당 서비스에서 진행해 주세요.</p></div><Link href="/guide" className="sidebar-guide"><Icon name="book" size={20} /><span>제휴마케팅이 처음인가요?<strong>부추 시작 가이드 읽기</strong></span><Icon name="chevron" size={16} /></Link></aside></div></div>;
}
