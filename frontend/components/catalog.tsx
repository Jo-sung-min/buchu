"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { channelLabels, type Channel, type Program } from "@/lib/types";
import { Icon } from "./icons";
import { ProgramCard } from "./program-card";
import { useSaved } from "./saved-provider";

export function Catalog({ programs, savedOnly = false }: { programs: Program[]; savedOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState("recommended");
  const { saved, ready } = useSaved();
  const items = useMemo(() => programs.filter(program => {
    const matchesQuery = [program.name, program.tagline, program.description, ...program.tags].join(" ").toLocaleLowerCase("ko").includes(query.trim().toLocaleLowerCase("ko"));
    return matchesQuery && (channel === "all" || program.channels.includes(channel)) && (!freeOnly || program.cost === "free") && (!savedOnly || saved.includes(program.slug));
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "ko") : Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "ko")), [programs, query, channel, freeOnly, savedOnly, saved, sort]);
  function reset() { setQuery(""); setChannel("all"); setFreeOnly(false); setSort("recommended"); }
  const filtered = !!query || channel !== "all" || freeOnly;
  return <section className={`catalog container ${savedOnly ? "saved-catalog" : ""}`} id="discover"><div className="section-heading"><div><div className="section-kicker">{savedOnly ? "MY COLLECTION" : "FIND YOUR SIDE HUSTLE"}</div><h2>{savedOnly ? "마음에 담아둔 부업" : "모두의 마케터"}<span className="heading-dot">.</span></h2><p>{savedOnly ? "관심 있는 부업을 모아두고, 내 속도로 시작해 보세요." : "나에게 익숙한 채널에서, 부담 없이 첫걸음을 시작해 보세요."}</p></div>{!savedOnly && <span className="curated-label"><Icon name="check" size={15} />공식 안내 · 승인된 기업 정보</span>}</div>
    <div className="search-row"><div className="search-field"><Icon name="search" size={21} /><input aria-label="부업 검색" placeholder="어떤 부업이 궁금하세요? 서비스명, 키워드 검색" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={17} /></button>}</div><label className="free-filter"><input type="checkbox" checked={freeOnly} onChange={e => setFreeOnly(e.target.checked)} /><span>무료 시작만 보기</span></label></div>
    <div className="filter-row"><div className="filter-chips" aria-label="활동 채널 필터"><button onClick={() => setChannel("all")} className={channel === "all" ? "selected" : ""} aria-pressed={channel === "all"}>전체</button>{Object.entries(channelLabels).map(([value, label]) => <button key={value} onClick={() => setChannel(value as Channel)} className={channel === value ? "selected" : ""} aria-pressed={channel === value}>{label}</button>)}</div><div className="sort-control"><Icon name="sliders" size={16} /><select aria-label="정렬 방식" value={sort} onChange={e => setSort(e.target.value)}><option value="recommended">부추 추천순</option><option value="name">이름순</option></select></div></div>
    <div className="results-line"><p role="status">{savedOnly && !ready ? "저장한 부업을 불러오고 있어요" : <>총 <strong>{items.length}</strong>개의 부업{savedOnly ? "을 담았어요" : "을 발견했어요"}</>}</p>{filtered && <button onClick={reset}>필터 초기화 <Icon name="close" size={13} /></button>}<span>차근차근, 새로운 기회를 더할게요.</span></div>
    {items.length > 0 ? <div className="program-grid">{items.map(program => <ProgramCard key={program.slug} program={program} />)}</div> : <div className="empty-state"><span><Icon name={savedOnly && !filtered ? "bookmark" : "search"} size={28} /></span><h3>{savedOnly && !filtered ? "아직 담아둔 부업이 없어요" : "검색 조건에 맞는 부업이 없어요"}</h3><p>{savedOnly && !filtered ? "눈길이 가는 서비스의 저장 버튼을 눌러 보세요." : "다른 키워드로 검색하거나 필터를 변경해 보세요."}</p>{savedOnly && !filtered ? <Link href="/#discover" className="button button-green">부업 둘러보기 <Icon name="arrow" size={17} /></Link> : <button className="button button-outline" onClick={reset}>전체 부업 보기</button>}</div>}
    {savedOnly && <p className="storage-note"><Icon name="info" size={15} />관심 부업은 현재 브라우저에 저장됩니다. 브라우저 데이터를 삭제하면 함께 지워져요.</p>}
  </section>;
}
