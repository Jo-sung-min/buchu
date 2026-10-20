"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Program } from "@/lib/types";
import { fetchReviews, fetchReviewSummary, reviewsChangedEvent, type Review, type ReviewSummary } from "@/lib/reviews";
import { fetchHomeFeed, fetchPosts, postCategories, postCategoryDescriptions, postsChangedEvent, type HomeFeed as HomeData, type Post } from "@/lib/posts";
import { Icon } from "./icons";
import { PostRow } from "./community/post-row";
import { AdUnit } from "./adsense/ad-unit";

/** Topic blocks per ad strip: two grid rows (four topics) of posts, then one full-width ad — Blind inserts a banner at the same cadence. */
const topicsPerAd = 4;

type Stat = ReviewSummary["programs"][number];
function isNew(program: Program) {
  const days = (Date.now() - new Date(program.verifiedAt).getTime()) / 86_400_000;
  return Number.isFinite(days) && days <= 30;
}
function rank(stats: Map<string, Stat>) {
  return (a: Program, b: Program) => {
    const sa = stats.get(a.slug), sb = stats.get(b.slug);
    return (sb?.reviewCount || 0) - (sa?.reviewCount || 0) || (sb?.averageRating || 0) - (sa?.averageRating || 0) || Number(b.featured) - Number(a.featured) || b.verifiedAt.localeCompare(a.verifiedAt);
  };
}

function Section({ title, description, href, children }: { title: string; description?: string; href?: string; children: React.ReactNode }) {
  return <section className="home-section">
    <header className="home-section-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link href={href}>더보기 <Icon name="chevron" size={13} /></Link>}</header>
    {children}
  </section>;
}

/** Community front page: today's topics, the newest posts, then one block per topic — with a live side-job ranking rail. */
export function HomeFeed({ programs, initialQuery = "", initialHome = null }: { programs: Program[]; initialQuery?: string; initialHome?: HomeData | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [home, setHome] = useState<HomeData | null>(initialHome);
  const [homeError, setHomeError] = useState("");
  const [results, setResults] = useState<Post[] | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(reviewsChangedEvent, refresh);
    window.addEventListener(postsChangedEvent, refresh);
    return () => { window.removeEventListener(reviewsChangedEvent, refresh); window.removeEventListener(postsChangedEvent, refresh); };
  }, []);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    const controller = new AbortController();
    setHomeError("");
    // The server already delivered the first copy; only refetch after a change or when that copy was missing.
    if (revision > 0 || !initialHome) fetchHomeFeed(controller.signal).then(setHome).catch(cause => { if (!controller.signal.aborted) setHomeError(cause instanceof Error ? cause.message : "글을 불러오지 못했어요."); });
    setReviewsFailed(false);
    Promise.all([fetchReviewSummary(controller.signal), fetchReviews({ size: 5, signal: controller.signal })])
      .then(([nextSummary, page]) => { setSummary(nextSummary); setReviews(page.items); })
      .catch(() => { if (!controller.signal.aborted) setReviewsFailed(true); });
    return () => controller.abort();
  }, [revision]);
  const needle = query.trim();
  useEffect(() => {
    if (!needle) { setResults(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPosts({ q: needle, size: 30, signal: controller.signal }).then(page => setResults(page.items)).catch(() => { if (!controller.signal.aborted) setResults([]); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [needle, revision]);

  const stats = useMemo(() => new Map((summary?.programs || []).map(item => [item.programSlug, item])), [summary]);
  const marketers = useMemo(() => programs.filter(program => (program.board || "MARKETER") === "MARKETER"), [programs]);
  const helpPosts = programs.length - marketers.length;
  const popularPrograms = useMemo(() => [...marketers].sort(rank(stats)).slice(0, 10), [marketers, stats]);
  const rows = (items: Post[], empty: string, writeHref: string) => items.length ? <ol className="home-rows">{items.map(post => <PostRow key={post.id} post={post} />)}</ol>
    : <div className="home-empty home-empty-quiet"><p>{empty} <Link href={writeHref}>첫 글 쓰기 →</Link></p></div>;

  return <div className="home">
    <div className="container">
      <form className="home-search" role="search" onSubmit={event => event.preventDefault()}>
        <Icon name="search" size={21} />
        <input aria-label="글 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="관심있는 내용을 검색해보세요!" maxLength={120} />
        {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={18} /></button>}
      </form>
      <div className="home-layout">
        <div className="home-main">
          {needle ? <Section title={`‘${needle}’ 검색 결과`} href={`/community?q=${encodeURIComponent(needle)}`}>
            {!results ? <div className="home-loading" role="status">검색 중…</div> : results.length ? <ol className="home-rows">{results.map(post => <PostRow key={post.id} post={post} />)}</ol>
              : <div className="home-empty"><h3>조건에 맞는 글이 없어요</h3><p>다른 검색어로 찾아보거나 직접 글을 남겨 보세요.</p><button onClick={() => setQuery("")}>전체 글 보기 <Icon name="arrow" size={15} /></button></div>}
          </Section> : homeError ? <div className="home-empty"><h3>글을 불러오지 못했어요</h3><p>{homeError}</p><button onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
          : !home ? <div className="home-loading" role="status">글 불러오는 중…</div> : <>
            <Section title="오늘의 주제" description="지금 가장 많이 보고 댓글 다는 글" href="/community?sort=popular">
              {rows(home.popular.slice(0, 8), "아직 글이 없어요.", "/community/write")}
            </Section>
            <AdUnit kind="feed" />
            <Section title="최신 글" href="/community">
              {rows(home.latest.slice(0, 8), "아직 글이 없어요.", "/community/write")}
            </Section>
            <div className="home-topics">
              {postCategories.map(([category, label], index) => <Fragment key={category}>
                <Section title={label} description={postCategoryDescriptions[category]} href={`/community?category=${category}`}>
                  {rows((home.byCategory[category] || []).slice(0, 5), `${label} 첫 글을 기다리고 있어요.`, `/community/write?category=${category}`)}
                </Section>
                {(index + 1) % topicsPerAd === 0 && index + 1 < postCategories.length && <AdUnit kind="feed" className="home-topics-ad" />}
              </Fragment>)}
            </div>
            <Section title="최근 익명 후기" description="부업 정보에 달린 솔직한 평가" href="/reviews">
              {reviews?.length ? <ol className="home-rows">{reviews.map(review => <li key={review.id} className="home-row">
                <span className="home-row-avatar home-row-avatar-anon" aria-hidden="true">익</span>
                <Link href={`/programs/${encodeURIComponent(review.programSlug)}`} className="home-row-topic">{review.programName}</Link>
                <Link href={`/programs/${encodeURIComponent(review.programSlug)}#review-${review.id}`} className="home-row-title">{review.title}</Link>
                <span className="home-row-counts"><span className="home-stars">★ {review.rating.toFixed(1)}</span><span>{review.nickname}</span></span>
              </li>)}</ol> : <div className="home-empty home-empty-quiet"><p>{reviewsFailed ? "후기를 불러오지 못했어요." : reviews ? <>아직 후기가 없어요. <Link href="/reviews/write">첫 후기 쓰기 →</Link></> : "후기 불러오는 중…"}</p></div>}
            </Section>
          </>}
        </div>
        <aside className="home-side" aria-label="인기 부업과 바로가기">
          <section className="home-popular" aria-labelledby="popular-title">
            <h2 id="popular-title">실시간 인기 부업</h2>
            {popularPrograms.length ? <ol>{popularPrograms.map((program, index) => {
              const stat = stats.get(program.slug);
              return <li key={program.slug}>
                <span className={`home-rank${index < 3 ? " top" : ""}`}>{index + 1}</span>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                {stat?.reviewCount ? <span className="home-popular-stat"><b>★ {stat.averageRating?.toFixed(1)}</b>{stat.reviewCount}</span> : isNew(program) || program.featured ? <span className="home-trend new">N</span> : <span className="home-trend">–</span>}
              </li>;
            })}</ol> : <p className="home-popular-empty">아직 등록된 부업이 없어요.</p>}
            <p className="home-popular-note"><Icon name="info" size={12} />후기 수와 평균 별점을 기준으로 집계한 순위</p>
          </section>
          <AdUnit kind="rect" />
          <nav className="home-side-topics" aria-label="주제 바로가기"><h2>주제</h2>
            <div>{postCategories.map(([category, label]) => <Link key={category} href={`/community?category=${category}`}>{label}</Link>)}</div>
          </nav>
          <nav className="home-side-links" aria-label="메뉴"><h2>둘러보기</h2>
            <Link href="/community"><strong>전체 글</strong><span>{home?.total ?? ""}</span></Link>
            <Link href="/programs"><strong>부업 정보</strong><span>{marketers.length}</span></Link>
            <Link href="/help"><strong>기업 홍보</strong><span>{helpPosts}</span></Link>
            <Link href="/courses"><strong>부업 클래스</strong><Icon name="chevron" size={14} /></Link>
          </nav>
          <nav className="home-side-quick" aria-label="바로가기">
            <Link href="/saved"><Icon name="bookmark" size={15} />관심 부업</Link>
            <Link href="/guide"><Icon name="book" size={15} />이용 가이드</Link>
            <Link href="/reviews/write"><Icon name="arrow-up" size={15} />후기 쓰기</Link>
            <Link href="/admin">관리자</Link>
          </nav>
          <Link href="/partners/apply?board=HELP" className="home-side-promo"><span>기업 · 파트너</span><strong>우리 부업을 부추에 소개하세요</strong><em>기업 홍보 게재 신청 <Icon name="arrow" size={13} /></em></Link>
        </aside>
      </div>
    </div>
  </div>;
}
