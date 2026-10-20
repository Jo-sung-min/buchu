"use client";
import { useEffect, useMemo, useState } from "react";
import { laborCautions, laborCenters, laborSites, laborSource, mapSearchUrl, type LaborIndex, type LaborSidoFile } from "@/lib/labor";
import { Icon } from "./icons";

const PAGE = 40;

/** 지역별 막노동 창구: 등록 인력사무소 목록(공개 데이터)과 그 지역의 공식 지원 기관·구인 사이트. */
export function LaborOffices() {
  const [index, setIndex] = useState<LaborIndex | null>(null);
  const [files, setFiles] = useState<Record<string, LaborSidoFile>>({});
  const [error, setError] = useState("");
  const [sido, setSido] = useState("");
  const [district, setDistrict] = useState("all");
  const [laborOnly, setLaborOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/labor-offices/index.json", { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json() as Promise<LaborIndex>; })
      .then(data => { setIndex(data); setSido(current => current || data.sidos[0]?.key || ""); })
      .catch(() => { if (!controller.signal.aborted) setError("인력사무소 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!sido || files[sido]) return;
    const controller = new AbortController();
    fetch(`/labor-offices/${sido}.json`, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json() as Promise<LaborSidoFile>; })
      .then(file => setFiles(current => ({ ...current, [sido]: file })))
      .catch(() => { if (!controller.signal.aborted) setError("이 지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."); });
    return () => controller.abort();
  }, [sido, files]);
  useEffect(() => { setDistrict("all"); setLimit(PAGE); }, [sido]);
  useEffect(() => { setLimit(PAGE); }, [district, laborOnly, query]);

  const current = index?.sidos.find(item => item.key === sido);
  const file = files[sido];
  const needle = query.trim();
  const items = useMemo(() => (file?.offices || []).filter(office => (district === "all" || office.g === district) && (!laborOnly || office.l) && (!needle || office.n.includes(needle) || office.a.includes(needle))), [file, district, laborOnly, needle]);
  const centers = laborCenters[sido] || [];

  if (error && !index) return <div className="community-empty"><Icon name="info" size={32} /><h3>{error}</h3></div>;
  if (!index) return <div className="home-loading" role="status">인력사무소 목록을 불러오는 중…</div>;
  return <div className="labor">
    <p className="labor-intro"><Icon name="info" size={14} />시·군·구에 등록돼 영업 중인 유료직업소개소 <b>{index.total.toLocaleString()}</b>곳이에요. 이름으로 보아 건설·일용 인력사무소로 보이는 곳은 <b>{index.laborTotal.toLocaleString()}</b>곳. {index.updatedAt.replaceAll("-", ".")} 기준 <a href={laborSource.url} target="_blank" rel="noreferrer">{laborSource.name}</a>.</p>
    <div className="community-filters labor-sido"><div aria-label="지역 선택">{index.sidos.map(item => <button key={item.key} onClick={() => setSido(item.key)} aria-pressed={sido === item.key} className={sido === item.key ? "active" : ""}>{item.name} <span>{(laborOnly ? item.laborCount : item.count).toLocaleString()}</span></button>)}</div></div>
    <div className="labor-controls">
      <select aria-label="시군구 선택" value={district} onChange={event => setDistrict(event.target.value)}>
        <option value="all">{current?.name} 전체 ({(laborOnly ? current?.laborCount : current?.count)?.toLocaleString()})</option>
        {current?.districts.map(item => <option key={item.name} value={item.name}>{item.name} ({(laborOnly ? item.laborCount : item.count).toLocaleString()})</option>)}
      </select>
      <label className="labor-toggle"><input type="checkbox" checked={laborOnly} onChange={event => setLaborOnly(event.target.checked)} /><span>인력사무소로 보이는 곳만</span></label>
      <div className="labor-search"><Icon name="search" size={15} /><input aria-label="사무소 이름·주소 검색" placeholder="이름·동네 검색" value={query} onChange={event => setQuery(event.target.value)} maxLength={40} />{query && <button aria-label="검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}</div>
    </div>
    <div className="community-count" role="status"><span>{current?.name}{district !== "all" && <> · {district}</>} <b>{items.length.toLocaleString()}</b>곳{needle && <> · ‘{needle}’ 검색 결과</>}</span><span>전화·운영 시간은 방문 전에 확인하세요</span></div>
    {!file && !error ? <div className="home-loading" role="status">{current?.name} 목록을 불러오는 중…</div>
      : items.length === 0 ? <div className="community-empty"><Icon name="search" size={30} /><h3>조건에 맞는 사무소가 없어요</h3><p>{laborOnly ? "‘인력사무소로 보이는 곳만’을 끄면 등록된 모든 직업소개소가 나와요." : "다른 시군구나 검색어로 다시 찾아보세요."}</p>{laborOnly && <button onClick={() => setLaborOnly(false)}>모든 직업소개소 보기 <Icon name="arrow" size={15} /></button>}</div>
      : <>
        <ul className="labor-list">
          {items.slice(0, limit).map(office => <li key={`${office.n}|${office.a}`} className="labor-office">
            <div className="labor-office-head"><h3>{office.n}</h3>{office.l && <span className="labor-badge">인력</span>}<span className="labor-district">{office.g}</span></div>
            <p className="labor-address">{office.a}</p>
            <div className="labor-office-meta">
              {office.t ? <a href={`tel:${office.t.replaceAll("-", "")}`}><Icon name="comment" size={13} />{office.t}</a> : <span className="labor-no-phone">전화 미등록</span>}
              {office.d && <span>등록 {office.d.slice(0, 4)}년</span>}
              <a href={mapSearchUrl(office)} target="_blank" rel="noreferrer"><Icon name="globe" size={13} />지도에서 보기</a>
            </div>
          </li>)}
        </ul>
        {items.length > limit && <button className="labor-more" onClick={() => setLimit(value => value + PAGE * 2)}>{Math.min(items.length - limit, PAGE * 2)}곳 더 보기 <Icon name="chevron" size={14} /></button>}
      </>}
    <section className="labor-support" aria-label="지역 공식 창구">
      <h2>{current?.name} 건설근로자 공식 창구</h2>
      <p>건설근로자공제회는 전국 대표번호 <a href="tel:16661122">1666-1122</a>를 누른 뒤 내선번호로 연결돼요. 취업 알선과 퇴직공제 상담을 함께 받을 수 있어요.</p>
      <div className="labor-centers">{centers.map(center => <article key={center.name + center.covers}><h3>{center.name}</h3><p>{center.address}</p><p className="labor-center-covers">담당: {center.covers}</p><a href="tel:16661122">1666-1122 → 내선 {center.extension}</a></article>)}</div>
      <h2>일용·건설 구인 글 찾기</h2>
      <ul className="labor-sites">{laborSites.map(site => <li key={site.name}><a href={site.url} target="_blank" rel="noreferrer">{site.name}{site.official && <span className="labor-official">공식</span>}<Icon name="arrow-up" size={13} /></a><p>{site.note}</p></li>)}</ul>
      <h2>이용 전 꼭 확인하세요</h2>
      <ul className="labor-cautions">{laborCautions.map(item => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
    </section>
  </div>;
}
