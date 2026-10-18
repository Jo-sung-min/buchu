import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/programs";
import { channelLabels, difficultyLabels, programCategoryLabel } from "@/lib/types";
import { BrandAvatar, SaveButton } from "@/components/program-card";
import { DetailContent, safeContentUrl } from "@/components/detail-content";
import { ProgramReviews } from "@/components/reviews/program-reviews";
import { Icon } from "@/components/icons";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const program = await getProgram((await params).slug);
  return { title: program?.name || "글을 찾을 수 없어요", description: program?.tagline };
}
export default async function ProgramPage({ params }: Props) {
  const program = await getProgram((await params).slug);
  if (!program) notFound();
  const help = program.board === "HELP";
  const cover = safeContentUrl(program.thumbnailUrl, true);
  const expired = program.deadline && program.deadline < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return <div className="container detail-page">
    <Link href={help ? "/help" : "/programs"} className="back-link"><Icon name="arrow" size={16} />{help ? "기업 홍보" : "부업 정보"}로 돌아가기</Link>
    <div className="detail-layout"><article>
      <div className="detail-heading"><BrandAvatar program={program} large /><div>
        <span className="detail-board-label">{help ? `기업 홍보 · ${program.helpType === "RECRUITMENT" ? "인재·협업 모집" : "홍보·마케팅"}` : `부업 정보 · ${programCategoryLabel(program.category)}`}{help && <span className="company-post-label">기업 글</span>}</span>
        {program.companyName && <span className="company-label">{program.companyName}</span>}
        <h1>{program.name}</h1><p>{program.tagline}</p>
      </div></div>
      {!help && <dl className="detail-glance"><div><dt>난이도</dt><dd>{difficultyLabels[program.difficulty]}</dd></div><div><dt>시작 비용</dt><dd className={program.cost === "free" ? "is-free" : ""}>{program.costLabel}</dd></div><div><dt>수익 방식</dt><dd>{program.commission}</dd></div><div><dt>활동 채널</dt><dd>{program.channels.map(channel => channelLabels[channel]).join(" · ")}</dd></div></dl>}
      {help ? <div className="help-detail-facts"><span>{expired ? "모집 마감" : "모집 중"}</span><span>{program.location || "활동 지역 협의"}</span><span>{program.deadline ? `${program.deadline.replaceAll("-", ".")} 마감` : "상시 모집"}</span></div> : <div className="detail-tags">{program.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      {!help && <nav className="detail-tabs" aria-label="부업 상세 보기"><a href="#program-info">부업 소개</a><a href="#how-to">시작 방법</a><a href="#reviews">익명 평가</a></nav>}
      <div id="program-info">{cover && <img className="submitted-cover" src={cover} alt={`${program.name} 대표 이미지`} />}
      <section className="detail-section"><h2>{help ? "어떤 기회인가요?" : "어떤 부업인가요?"}</h2><p>{program.description}</p>
        {program.highlights?.length > 0 && <div className="highlight-list">{program.highlights.map(item => <div key={item}><span><Icon name="check" size={16} /></span>{item}</div>)}</div>}
      </section>
      {!help && program.steps?.length > 0 && <section className="detail-section detail-howto" id="how-to"><h2><span>HOW TO</span>이렇게 시작해요</h2><p>{program.name}을(를) 처음 해보는 분 기준으로, 가입부터 첫 수익 확인까지 순서대로 정리했어요.</p><ol className="step-list">{program.steps.map((step, i) => <li key={step}><span>{i + 1}</span><p>{step}</p></li>)}</ol><div className="detail-howto-foot"><a href={program.officialUrl} target="_blank" rel="noopener noreferrer">공식 사이트에서 시작하기 <Icon name="arrow-up" size={15} /></a><Link href={`/community/write?category=QUESTION`}>막히는 부분 질문하기 <Icon name="comment" size={15} /></Link></div></section>}
      {program.content ? <section className="detail-section"><h2>{help ? "모집·홍보 상세 내용" : "서비스 자세히 알아보기"}</h2><DetailContent content={program.content} /></section> : help && program.steps?.length > 0 && <section className="detail-section"><h2>이렇게 시작해 보세요</h2><ol className="step-list">{program.steps.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>}
      {help ? <section className="caution-panel"><h2><Icon name="info" size={20} />지원하기 전에 확인하세요</h2><ul><li>업무 범위와 보상, 지급일은 기업의 공식 안내에서 확인해 주세요.</li><li>모집 조건과 일정은 기업 사정에 따라 변경될 수 있습니다.</li></ul></section> : program.cautions?.length > 0 && <section className="caution-panel"><h2><Icon name="info" size={20} />시작 전에 꼭 확인해요</h2><ul>{program.cautions.map(caution => <li key={caution}>{caution}</li>)}</ul></section>}
      <div className="source-note"><Icon name="globe" size={16} /><div>{program.companyName ? "기업이 등록한 소개 · 게시일" : "공식 공개 정보 확인"}: {program.verifiedAt.replaceAll("-", ".")}<br /><a href={program.guideUrl} target="_blank" rel="noopener noreferrer">공식 안내에서 최신 조건 확인하기 ↗</a></div></div></div>
      {!help && <ProgramReviews programSlug={program.slug} programName={program.name} />}
    </article><aside className="detail-sidebar"><div className="summary-card"><span className="section-kicker">한눈에 살펴보기</span><h2>{help ? "함께할 기회를 살펴보세요" : "나에게 맞는 부업일까요?"}</h2><dl>
      {help ? <><div><dt>모집 분야</dt><dd>{program.helpType === "RECRUITMENT" ? "인재·협업 모집" : "홍보·마케팅"}</dd></div><div><dt>활동 지역</dt><dd>{program.location || "협의 가능"}</dd></div><div><dt>모집 기한</dt><dd>{program.deadline ? program.deadline.replaceAll("-", ".") : "상시 모집"}</dd></div></> : <><div><dt>시작 비용</dt><dd>{program.costLabel}</dd></div><div><dt>활동 채널</dt><dd>{program.channels.map(channel => channelLabels[channel]).join(" · ")}</dd></div></>}
      <div><dt>{help ? "보상 조건" : "수익 방식"}</dt><dd>{program.commission}</dd></div>
      <div><dt>{help ? "지급 조건" : "정산 안내"}</dt><dd>{program.settlement}</dd></div>
    </dl><a className="button button-green" href={program.officialUrl} target="_blank" rel="noopener noreferrer">{help ? "문의·지원 페이지" : "공식 사이트 방문하기"} <Icon name="arrow-up" size={18} /></a><SaveButton program={program} full /><p className="sidebar-note">새 창에서 기업의 공식 페이지로 이동합니다.<br />{help ? "문의와 지원은 해당 기업에서 진행해 주세요." : "가입과 활동은 해당 서비스에서 진행해 주세요."}</p></div>{!help && <Link href="/guide" className="sidebar-guide"><Icon name="book" size={20} /><span>제휴마케팅이 처음인가요?<strong>부추 시작 가이드 읽기</strong></span><Icon name="chevron" size={16} /></Link>}</aside></div>
  </div>;
}
