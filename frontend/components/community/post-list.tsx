"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPosts, postCategories, postCategoryDescriptions, postCategoryLabels, postsChangedEvent, type PostCategory, type PostPage, type PostSort } from "@/lib/posts";
import { Icon } from "../icons";
import { PostRow } from "./post-row";

export function PostList({ initialQuery = "", initialCategory = "", initialSort = "latest" }: { initialQuery?: string; initialCategory?: PostCategory | ""; initialSort?: PostSort }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<PostCategory | "">(initialCategory);
  const [sort, setSort] = useState<PostSort>(initialSort);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PostPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const size = 20;
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener(postsChangedEvent, refresh);
    return () => window.removeEventListener(postsChangedEvent, refresh);
  }, []);
  useEffect(() => { setQuery(initialQuery); setCategory(initialCategory); setSort(initialSort); setPage(0); }, [initialQuery, initialCategory, initialSort]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      fetchPosts({ category, sort, q: query, page, size, signal: controller.signal })
        .then(result => {
          if (controller.signal.aborted) return;
          if (!result.items.length && page > 0 && result.total <= page * size) { setPage(Math.max(0, Math.ceil(result.total / size) - 1)); return; }
          setData(result);
        })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "글을 불러오지 못했어요."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [category, sort, query, page, version]);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return <div className="post-list" aria-busy={loading}>
    <div className="post-list-toolbar">
      <div className="home-filters post-list-categories" aria-label="글 주제"><button aria-pressed={!category} className={!category ? "active" : ""} onClick={() => { setCategory(""); setPage(0); }}>전체</button>{postCategories.map(([value, label]) => <button key={value} aria-pressed={category === value} className={category === value ? "active" : ""} onClick={() => { setCategory(value); setPage(0); }}>{label}</button>)}</div>
      <div className="post-list-tools">
        <label className="post-list-search"><Icon name="search" size={16} /><input aria-label="글 검색" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="글 검색" maxLength={120} /></label>
        <select aria-label="정렬" value={sort} onChange={event => { setSort(event.target.value as PostSort); setPage(0); }}><option value="latest">최신순</option><option value="popular">인기순</option><option value="comments">댓글 많은순</option></select>
      </div>
    </div>
    {category && <p className="post-list-description">{postCategoryLabels[category]} · {postCategoryDescriptions[category]}</p>}
    <div className="post-list-count" role="status">전체 <b>{data ? data.total.toLocaleString() : "—"}</b>건{query.trim() && <> · ‘{query.trim()}’ 검색 결과</>}</div>
    {error ? <div className="home-empty"><h3>글을 불러오지 못했어요</h3><p>{error}</p><button onClick={() => setVersion(value => value + 1)}>다시 불러오기</button></div>
      : !data ? <div className="home-loading" role="status">글 불러오는 중…</div>
      : data.items.length ? <ol className="home-rows">{data.items.map(post => <PostRow key={post.id} post={post} />)}</ol>
      : <div className="home-empty"><h3>{query.trim() || category ? "조건에 맞는 글이 없어요" : "아직 글이 없어요"}</h3><p>{query.trim() ? "검색어나 주제를 바꿔 보세요." : category ? `${postCategoryLabels[category]} 첫 글을 남겨 보세요.` : "첫 글을 남겨 소통을 시작해 보세요."}</p>{query.trim() ? <button onClick={() => { setQuery(""); setCategory(""); }}>전체 글 보기 <Icon name="arrow" size={15} /></button> : <Link href={`/community/write${category ? `?category=${category}` : ""}`}>글쓰기 <Icon name="arrow" size={15} /></Link>}</div>}
    {data && pages > 1 && <nav className="post-pagination" aria-label="글 페이지"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>이전</button><span><strong>{page + 1}</strong> / {pages}</span><button type="button" disabled={page + 1 >= pages || loading} onClick={() => setPage(value => value + 1)}>다음</button></nav>}
  </div>;
}
