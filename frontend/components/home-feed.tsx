"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Program } from "@/lib/types";
import { fetchReviews, fetchReviewSummary, reviewsChangedEvent, type Review, type ReviewSummary } from "@/lib/reviews";
import { fetchPosts, postCategories, postsChangedEvent, type Post, type PostCategory } from "@/lib/posts";
import { Icon } from "./icons";
import { PostRow } from "./community/post-row";

type Stat = ReviewSummary["programs"][number];
type Tab = "popular" | "latest" | "reviews";
const tabs: [Tab, string][] = [["popular", "인기 글"], ["latest", "최신 글"], ["reviews", "익명 후기"]];
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

/** Community front page: a Blind-like feed of anonymous posts with a live side-job ranking rail. */
export function HomeFeed({ programs, initialQuery = "" }: { programs: Program[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("popular");
  const [category, setCategory] = useState<PostCategory | "">("");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [postTotal, setPostTotal] = useState<number | null>(null);
  const [postsError, setPostsError] = useState("");
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
    setReviewsFailed(false);
    Promise.all([fetchReviewSummary(controller.signal), fetchReviews({ size: 5, signal: controller.signal })])
      .then(([nextSummary, page]) => { setSummary(nextSummary); setReviews(page.items); })
      .catch(() => { if (!controller.signal.aborted) setReviewsFailed(true); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPostsError("");
      fetchPosts({ sort: tab === "latest" ? "latest" : "popular", category, q: query, size: 15, signal: controller.signal })
        .then(page => { setPosts(page.items); setPostTotal(page.total); })
        .catch(cause => { if (!controller.signal.aborted) setPostsError(cause instanceof Error ? cause.message : "글을 불러오지 못했어요."); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, category, query, revision]);

  const stats = useMemo(() => new Map((summary?.programs || []).map(item => [item.programSlug, item])), [summary]);
  const marketers = useMemo(() => programs.filter(program => (program.board || "MARKETER") === "MARKETER"), [programs]);
  const helpPosts = programs.length - marketers.length;
  const popular = useMemo(() => [...marketers].sort(rank(stats)).slice(0, 10), [marketers, stats]);
  const needle = query.trim().toLowerCase();
  const reviewRows = (reviews || []).filter(review => !needle || [review.title, review.content, review.programName].join(" ").toLowerCase().includes(needle));
  const filtering = Boolean(needle) || Boolean(category);

  return <div className="home">
    <section className="home-banner" aria-label="부추 소개">
      <div className="container home-banner-inner">
        <div><strong>부업하는 사람들의 소통 공간 | 부추</strong><p>익명으로 경험과 질문, 꿀팁을 나누고 해본 사람들의 솔직한 후기를 확인하세요</p></div>
        <Link href="/community/write" className="home-banner-cta">글쓰기 <Icon name="arrow" size={15} /></Link>
      </div>
    </section>
    <div className="container">
      <form className="home-search" role="search" onSubmit={event => event.preventDefault()}>
        <Icon name="search" size={21} />
        <input aria-label="글·후기 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="관심있는 내용을 검색해보세요!" maxLength={120} />
        {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={18} /></button>}
      </form>
      <div className="home-layout">
        <div className="home-main">
          <div className="home-tabs" role="tablist" aria-label="메인 피드">{tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}{value === "reviews" && summary ? <span>{summary.totalReviews}</span> : value === "popular" && postTotal != null && !filtering ? <span>{postTotal}</span> : null}</button>)}</div>
          {tab === "reviews" ? <section className="home-section" aria-label="익명 후기">
            <header className="home-section-head"><h2>익명 후기</h2><Link href="/reviews">더보기 <Icon name="chevron" size={13} /></Link></header>
            {reviewsFailed ? <div className="home-empty"><h3>후기를 불러오지 못했어요</h3><button onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
              : !reviews ? <div className="home-loading" role="status">후기 불러오는 중…</div>
              : reviewRows.length ? <ol className="home-rows">{reviewRows.map(review => <li key={review.id} className="home-row">
                <span className="home-row-avatar home-row-avatar-anon" aria-hidden="true">익</span>
                <Link href={`/programs/${encodeURIComponent(review.programSlug)}`} className="home-row-topic">{review.programName}</Link>
                <Link href={`/programs/${encodeURIComponent(review.programSlug)}#review-${review.id}`} className="home-row-title">{review.title}</Link>
                <span className="home-row-counts"><span className="home-stars" aria-label={`별점 ${review.rating}점`}>★ {review.rating.toFixed(1)}</span><span>{review.nickname}</span></span>
              </li>)}</ol>
              : <div className="home-empty"><h3>{needle ? "조건에 맞는 후기가 없어요" : "아직 후기가 없어요"}</h3><p>첫 익명 후기를 남겨 보세요.</p><Link href="/reviews/write">후기 쓰기 <Icon name="arrow" size={15} /></Link></div>}
          </section> : <section className="home-section" aria-label={tab === "latest" ? "최신 글" : "인기 글"}>
            <header className="home-section-head"><h2>{tab === "latest" ? "최신 글" : "인기 글"}</h2><div className="home-filters" aria-label="글 주제"><button aria-pressed={!category} className={!category ? "active" : ""} onClick={() => setCategory("")}>전체</button>{postCategories.map(([value, label]) => <button key={value} aria-pressed={category === value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{label}</button>)}</div></header>
            {postsError ? <div className="home-empty"><h3>글을 불러오지 못했어요</h3><p>{postsError}</p><button onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
              : !posts ? <div className="home-loading" role="status">글 불러오는 중…</div>
              : posts.length ? <><ol className="home-rows">{posts.map(post => <PostRow key={post.id} post={post} />)}</ol><Link href="/community" className="home-more">소통 글 전체 보기 <Icon name="arrow" size={14} /></Link></>
              : <div className="home-empty"><h3>{filtering ? "조건에 맞는 글이 없어요" : "아직 글이 없어요"}</h3><p>{filtering ? "검색어나 주제를 바꿔 보세요." : "첫 글을 남겨 소통을 시작해 보세요."}</p>{filtering ? <button onClick={() => { setQuery(""); setCategory(""); }}>전체 글 보기 <Icon name="arrow" size={15} /></button> : <Link href="/community/write">글쓰기 <Icon name="arrow" size={15} /></Link>}</div>}
          </section>}
          {tab !== "reviews" && !needle && <section className="home-section" aria-label="최근 익명 후기">
            <header className="home-section-head"><h2>최근 익명 후기</h2><Link href="/reviews">더보기 <Icon name="chevron" size={13} /></Link></header>
            {reviews?.length ? <ol className="home-rows">{reviews.map(review => <li key={review.id} className="home-row">
              <span className="home-row-avatar home-row-avatar-anon" aria-hidden="true">익</span>
              <Link href={`/programs/${encodeURIComponent(review.programSlug)}`} className="home-row-topic">{review.programName}</Link>
              <Link href={`/programs/${encodeURIComponent(review.programSlug)}#review-${review.id}`} className="home-row-title">{review.title}</Link>
              <span className="home-row-counts"><span className="home-stars">★ {review.rating.toFixed(1)}</span><span>{review.nickname}</span></span>
            </li>)}</ol> : <div className="home-empty home-empty-quiet"><p>{reviewsFailed ? "후기를 불러오지 못했어요." : reviews ? "아직 후기가 없어요. 부업 정보에서 첫 후기를 남겨 보세요." : "후기 불러오는 중…"}</p></div>}
          </section>}
        </div>
        <aside className="home-side" aria-label="인기 부업과 바로가기">
          <section className="home-popular" aria-labelledby="popular-title">
            <h2 id="popular-title">실시간 인기 부업</h2>
            {popular.length ? <ol>{popular.map((program, index) => {
              const stat = stats.get(program.slug);
              return <li key={program.slug}>
                <span className={`home-rank${index < 3 ? " top" : ""}`}>{index + 1}</span>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                {stat?.reviewCount ? <span className="home-popular-stat"><b>★ {stat.averageRating?.toFixed(1)}</b>{stat.reviewCount}</span> : isNew(program) || program.featured ? <span className="home-trend new">N</span> : <span className="home-trend">–</span>}
              </li>;
            })}</ol> : <p className="home-popular-empty">아직 등록된 부업이 없어요.</p>}
            <p className="home-popular-note"><Icon name="info" size={12} />후기 수와 평균 별점을 기준으로 집계한 순위</p>
          </section>
          <nav className="home-side-links" aria-label="메뉴"><h2>둘러보기</h2>
            <Link href="/community"><strong>소통</strong><span>{postTotal ?? ""}</span></Link>
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
