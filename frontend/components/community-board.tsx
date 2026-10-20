"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type AgeGroup, type Program, ageGroupLabels, ageGroups, channelLabels, programCategoryLabel, programCategoryLabels } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { api } from "@/lib/submissions";
import { BrandAvatar, SaveButton } from "./program-card";
import { Icon } from "./icons";
import { ReviewFeed } from "./reviews/review-feed";
import { ProgramGrid } from "./program-grid";
import { LaborOffices } from "./labor-offices";
import { reviewsChangedEvent } from "@/lib/reviews";

type Summary = { totalReviews: number; averageRating: number; programs: { programSlug: string; reviewCount: number; averageRating: number }[] };
function closed(program: Program) { return Boolean(program.deadline && program.deadline < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })); }

export type BoardView = "programs" | "reviews" | "labor";
export function CommunityBoard({ programs, board = "MARKETER", initialQuery = "", initialView = "programs" }: { programs: Program[]; board?: "MARKETER" | "HELP"; initialQuery?: string; initialView?: BoardView }) {
  const help = board === "HELP";
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("all");
  const { member, ready: authReady } = useAuth();
  /** null = follow the member's own age group; "all" or a band = an explicit choice. */
  const [ageChoice, setAgeChoice] = useState<AgeGroup | "all" | null>(null);
  const age: AgeGroup | "all" = ageChoice ?? (!help && member?.ageGroup ? member.ageGroup : "all");
  const [view, setView] = useState<BoardView>(help ? "programs" : initialView);
  const [sort, setSort] = useState("default");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(reviewsChangedEvent, refresh);
    return () => window.removeEventListener(reviewsChangedEvent, refresh);
  }, []);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    const controller = new AbortController();
    setStatsError(false);
    api<Summary>("/api/reviews/summary", { signal: controller.signal }).then(setSummary).catch(() => { if (!controller.signal.aborted) setStatsError(true); });
    return () => controller.abort();
  }, [revision]);
  const stats = useMemo(() => new Map((summary?.programs || []).map(item => [item.programSlug, item])), [summary]);
  const boardItems = programs.filter(program => (program.board || "MARKETER") === board);
  const items = boardItems.filter(program => {
    const matches = [program.name, program.tagline, program.description, program.companyName || "", program.location || "", ...program.tags].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    const forAge = age === "all" || !program.ageGroups?.length || program.ageGroups.includes(age);
    return matches && forAge && (filter === "all" || (help ? program.helpType === filter : program.category === filter));
  }).sort((a, b) => {
    if (sort === "rating") return (stats.get(b.slug)?.averageRating || 0) - (stats.get(a.slug)?.averageRating || 0) || (stats.get(b.slug)?.reviewCount || 0) - (stats.get(a.slug)?.reviewCount || 0);
    if (sort === "reviews") return (stats.get(b.slug)?.reviewCount || 0) - (stats.get(a.slug)?.reviewCount || 0);
    if (sort === "name") return a.name.localeCompare(b.name, "ko");
    return help ? Number(closed(a)) - Number(closed(b)) || b.verifiedAt.localeCompare(a.verifiedAt) : Number(b.featured) - Number(a.featured);
  });
  return <div className="container community-layout">
    <div className="community-main">
      <header className="community-page-heading"><h1 id="board-title">{help ? "기업 홍보" : "부업 정보"}</h1><Link href={help ? "/partners/apply?board=HELP" : "/reviews/write"} className="button button-outline">{help ? "글쓰기" : "후기 쓰기"}<Icon name="arrow-up" size={15} /></Link></header>
      <div className="community-search"><Icon name="search" size={19} /><input aria-label={help ? "모집·홍보 검색" : "부업 검색"} value={query} onChange={e => { setQuery(e.target.value); setView("programs"); }} placeholder={help ? "기업·모집 검색" : "부업 검색"} maxLength={120} />{query && <button aria-label="검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={18} /></button>}</div>
      <section className="community-board" id="discover" aria-labelledby="board-title">
        {!help && <div className="community-view-tabs" aria-label="부업 정보 보기"><button aria-pressed={view === "programs"} className={view === "programs" ? "active" : ""} onClick={() => setView("programs")}>부업 <span>{boardItems.length}</span></button><button aria-pressed={view === "reviews"} className={view === "reviews" ? "active" : ""} onClick={() => setView("reviews")}>익명 후기 {summary && <span>{summary.totalReviews}</span>}</button><button aria-pressed={view === "labor"} className={view === "labor" ? "active" : ""} onClick={() => setView("labor")}>지역 인력사무소</button></div>}
        {view === "labor" && !help ? <LaborOffices /> : view === "reviews" && !help ? <div className="community-review-list"><ReviewFeed /></div> : <>
          <div className="community-filters"><div aria-label="주제 필터">{(help ? [["all", "전체"], ["PROMOTION", "홍보·마케팅"], ["RECRUITMENT", "인재·협업 모집"]] : [["all", "전체"], ...Object.entries(programCategoryLabels)]).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={filter === value ? "active" : ""}>{label}</button>)}</div><select aria-label="목록 정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="default">{help ? "최신 등록순" : "기본순"}</option>{!help && <><option value="rating">별점 높은순</option><option value="reviews">후기 많은순</option></>}<option value="name">이름순</option></select></div>
          {!help && <div className="age-filter" role="group" aria-label="나이대 필터"><span>나이대</span><div><button onClick={() => setAgeChoice("all")} aria-pressed={age === "all"} className={age === "all" ? "active" : ""}>전체</button>{ageGroups.map(value => <button key={value} onClick={() => setAgeChoice(value)} aria-pressed={age === value} className={age === value ? "active" : ""}>{ageGroupLabels[value]}</button>)}</div>
            {ageChoice === null && member?.ageGroup ? <p className="age-filter-note"><Icon name="check" size={14} />{member.nickname} 님의 나이대({ageGroupLabels[member.ageGroup]})에 맞는 부업을 먼저 보여드려요.<button type="button" onClick={() => setAgeChoice("all")}>전체 보기</button></p>
            : authReady && !member && age === "all" ? <p className="age-filter-note"><Icon name="info" size={14} />로그인하고 나이대를 저장하면 내게 맞는 부업만 먼저 보여드려요.<Link href="/register?next=%2Fprograms">회원가입</Link></p> : null}</div>}
          <div className="community-count" role="status"><span>전체 <b>{items.length}</b>건{query && <> · ‘{query}’ 검색 결과</>}{!help && age !== "all" && <> · {ageGroupLabels[age]} 추천</>}</span></div>
          {items.length ? (!help ? <ProgramGrid items={items} stats={stats} loaded={Boolean(summary)} statsError={statsError} mine={age === "all" ? member?.ageGroup || null : age} /> : <div className="community-rows">{items.map(program => {
            const rating = stats.get(program.slug);
            return <article className="community-row" key={program.slug}><div className="community-row-avatar"><BrandAvatar program={program} /></div><div className="community-row-content"><div className="community-row-category">{help ? <><span className="company-post-label">기업 글</span>{program.companyName}<span>·</span>{program.helpType === "RECRUITMENT" ? "인재·협업 모집" : "홍보·마케팅"}</> : <>{programCategoryLabel(program.category)}<span>·</span>{program.channels.map(channel => channelLabels[channel]).join(" / ")}</>}</div><h3><Link href={`${program.board === "HELP" ? "/help" : "/programs"}/${program.slug}`}>{program.name}</Link>{help && <span className={`recruitment-state ${closed(program) ? "closed" : ""}`}>{closed(program) ? "마감" : "모집 중"}</span>}</h3>{help && <div className="community-row-tags">{[program.location || "지역 협의", program.deadline ? `${program.deadline.replaceAll("-", ".")}까지` : "상시 모집"].map(tag => <span key={tag}>{tag}</span>)}</div>}<div className="community-row-meta">{help ? <span><Icon name="info" size={14} />{program.commission}</span> : <><Link href={`/programs/${program.slug}#reviews`} className="row-review-link"><span className={rating?.reviewCount ? "rating-star" : "rating-star empty"}>★</span>{statsError ? "후기 확인" : rating?.reviewCount ? <><b>{rating.averageRating.toFixed(1)}</b><span>후기 {rating.reviewCount}</span></> : summary ? "후기 0" : "후기 불러오는 중"}</Link><span className="row-meta-separator">·</span><span>{program.costLabel}</span></>}</div></div><SaveButton program={program} /></article>;
          })}</div>) : <div className="community-empty"><Icon name={query ? "search" : "book"} size={32} /><h3>{query || filter !== "all" || age !== "all" ? "조건에 맞는 글이 없어요" : help ? "등록된 글이 없어요" : "등록된 부업이 없어요"}</h3><p>{query || filter !== "all" || age !== "all" ? "검색어, 주제나 나이대를 바꿔 다시 찾아보세요." : help ? "게재 신청을 통해 글을 등록할 수 있어요." : "게재 신청을 통해 부업을 등록할 수 있어요."}</p>{query || filter !== "all" || age !== "all" ? <button onClick={() => { setQuery(""); setFilter("all"); setAgeChoice("all"); }}>전체 글 보기 <Icon name="arrow" size={16} /></button> : <Link href={help ? "/partners/apply?board=HELP" : "/partners/apply"}>게재 신청 <Icon name="arrow" size={16} /></Link>}</div>}
        </>}
      </section>
      {!help && view === "programs" && !query && <section className="community-latest"><div className="community-section-title"><h2>최근 후기</h2><Link href="/reviews">전체 보기 <Icon name="chevron" size={14} /></Link></div><ReviewFeed compact /></section>}
    </div>
    <aside className="community-sidebar" aria-label="주제와 바로가기">
      <nav className="community-topics" aria-label="주제"><h2>주제</h2><Link href="/programs" className={!help ? "active" : ""} aria-current={!help ? "page" : undefined}><strong>부업 정보</strong><span>{programs.filter(p => p.board !== "HELP").length}</span></Link><Link href="/help" className={help ? "active" : ""} aria-current={help ? "page" : undefined}><strong>기업 홍보</strong><span>{programs.filter(p => p.board === "HELP").length}</span></Link><Link href="/courses"><strong>부업 클래스</strong><Icon name="chevron" size={15} /></Link></nav>
      <nav className="community-side-actions" aria-label="바로가기"><Link href="/programs?view=labor" onClick={event => { if (!help) { event.preventDefault(); setView("labor"); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><Icon name="globe" size={16} />지역 인력사무소</Link><Link href="/saved"><Icon name="bookmark" size={16} />관심 부업</Link><Link href="/guide"><Icon name="book" size={16} />이용 가이드</Link><Link href={help ? "/partners/apply?board=HELP" : "/partners/apply"}><Icon name="arrow-up" size={16} />게재 신청</Link></nav>
      <div className="community-sidebar-footer"><Link href="/admin">관리자</Link></div>
    </aside>
  </div>;
}
