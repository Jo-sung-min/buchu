"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/submissions";
import { authorLabel, fetchComments, postCategories, postCategoryLabels, postDateTime, type Post, type PostCategory, type PostComment, type PostPage, type PostSort } from "@/lib/posts";
import { Icon } from "./icons";

const pageSize = 10;
const sortLabels: Record<PostSort, string> = { latest: "최신순", popular: "조회순", comments: "댓글순" };
type CommentState = { loading: boolean; error: string; items: PostComment[] };

export function AdminPosts({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [category, setCategory] = useState<PostCategory | "">("");
  const [sort, setSort] = useState<PostSort>("latest");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<PostPage>({ items: [], total: 0, page: 0, size: pageSize });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentState>>({});
  const [commentConfirmId, setCommentConfirmId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const busy = !!deletingId || !!deletingCommentId;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setConfirmId(null); setExpandedId(null); setCommentConfirmId(null);
    const params = new URLSearchParams({ sort, page: String(page), size: String(pageSize) });
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    api<PostPage>(`/api/admin/posts?${params}`, { signal: controller.signal }).then(setList).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "글 목록을 불러오지 못했습니다.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, sort, search, page, revision, onSessionExpired]);

  useEffect(() => {
    if (!expandedId) return;
    const postId = expandedId;
    const controller = new AbortController();
    setComments(value => ({ ...value, [postId]: { loading: true, error: "", items: value[postId]?.items ?? [] } }));
    fetchComments(postId, controller.signal).then(items => {
      if (!controller.signal.aborted) setComments(value => ({ ...value, [postId]: { loading: false, error: "", items } }));
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setComments(value => ({ ...value, [postId]: { loading: false, error: cause instanceof Error ? cause.message : "댓글을 불러오지 못했습니다.", items: [] } }));
    });
    return () => controller.abort();
  }, [expandedId]);

  function toggleComments(post: Post) {
    setCommentConfirmId(null);
    setExpandedId(value => value === post.id ? null : post.id);
  }

  async function removePost(post: Post) {
    if (busy) return;
    setDeletingId(post.id); setError(""); setFeedback("");
    try {
      await api(`/api/admin/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      setConfirmId(null);
      if (expandedId === post.id) setExpandedId(null);
      setFeedback("글을 삭제했습니다. 댓글도 함께 사라지며 소통 게시판에서 더 이상 보이지 않습니다.");
      if (list.items.length === 1 && page > 0) setPage(value => value - 1);
      else setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "글을 삭제하지 못했습니다.");
    } finally { setDeletingId(null); }
  }

  async function removeComment(post: Post, comment: PostComment) {
    if (busy) return;
    setDeletingCommentId(comment.id); setError(""); setFeedback("");
    try {
      await api(`/api/admin/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
      setCommentConfirmId(null);
      setComments(value => ({ ...value, [post.id]: { loading: false, error: "", items: (value[post.id]?.items ?? []).filter(item => item.id !== comment.id) } }));
      setList(value => ({ ...value, items: value.items.map(item => item.id === post.id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item) }));
      setFeedback("댓글을 삭제했습니다.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(cause instanceof Error ? cause.message : "댓글을 삭제하지 못했습니다.");
    } finally { setDeletingCommentId(null); }
  }

  return <section className="admin-reviews admin-posts" aria-label="소통 글 관리">
    <div className="admin-reviews-heading"><div><h2>소통 글</h2><p>광고, 도배, 개인정보 노출 등 운영 기준을 위반한 글과 댓글을 확인하고 삭제하세요.</p></div><button type="button" className="admin-refresh" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>새로고침</button></div>
    <div className="admin-status-tabs admin-posts-categories" role="group" aria-label="카테고리"><button type="button" className={category === "" ? "active" : ""} aria-pressed={category === ""} disabled={busy} onClick={() => { setCategory(""); setPage(0); setFeedback(""); }}>전체</button>{postCategories.map(([value, label]) => <button type="button" key={value} className={category === value ? "active" : ""} aria-pressed={category === value} disabled={busy} onClick={() => { setCategory(value); setPage(0); setFeedback(""); }}>{label}</button>)}</div>
    <form className="admin-search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(0); setFeedback(""); }}><Icon name="search" size={18} /><input aria-label="소통 글 검색" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="제목, 내용, 닉네임으로 검색" maxLength={120} /><label className="submission-sr-only" htmlFor="admin-post-sort">정렬</label><select id="admin-post-sort" className="admin-posts-sort" value={sort} disabled={busy} onChange={event => { setSort(event.target.value as PostSort); setPage(0); setFeedback(""); }}>{(Object.keys(sortLabels) as PostSort[]).map(value => <option key={value} value={value}>{sortLabels[value]}</option>)}</select><button type="submit" disabled={busy}>검색</button>{search && <button type="button" disabled={busy} onClick={() => { setQuery(""); setSearch(""); setPage(0); setFeedback(""); }}>전체 보기</button>}</form>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    <div className="admin-result-count" role="status">{loading ? "글을 불러오고 있습니다…" : `총 ${list.total}개의 글 · ${sortLabels[sort]}${search ? ` · "${search}" 검색 결과` : ""}`}</div>
    {!loading && !error && list.items.length === 0 && <div className="admin-empty"><Icon name="book" size={30} /><h3>해당하는 글이 없습니다</h3><p>방문자가 소통 게시판에 남긴 글과 댓글을 여기에서 관리할 수 있습니다.</p></div>}
    <div className="admin-review-items" aria-busy={loading}>{list.items.map(post => {
      const expanded = expandedId === post.id;
      const thread = comments[post.id];
      return <article className="admin-review-item admin-post-item" key={post.id}>
        <div className="admin-review-meta"><span><span className="admin-post-category">{postCategoryLabels[post.category] ?? post.category}</span><Link href={`/community/${encodeURIComponent(post.id)}`} target="_blank">글 보기 ↗</Link></span><time dateTime={post.createdAt}>{postDateTime(post.createdAt)}</time></div>
        <h3>{post.title}</h3><p className="admin-review-body admin-post-body">{post.content}</p>
        <div className="admin-post-stats"><span>{authorLabel(post)}{post.authorType === "MEMBER" ? " · 회원" : ""}</span><span>조회 {post.viewCount}</span><span>댓글 {post.commentCount}</span></div>
        <div className="admin-post-actions"><button type="button" className="admin-post-toggle" aria-expanded={expanded} aria-controls={`admin-post-comments-${post.id}`} disabled={loading || busy} onClick={() => toggleComments(post)}><Icon name="chevron" size={15} />{expanded ? "댓글 닫기" : `댓글 보기 (${post.commentCount})`}</button>{confirmId === post.id ? null : <button type="button" className="admin-review-delete" disabled={loading || busy} onClick={() => { setConfirmId(post.id); setCommentConfirmId(null); }}>글 삭제</button>}</div>
        {confirmId === post.id && <div className="admin-review-delete-confirm"><p>이 글을 삭제할까요? 달린 댓글도 함께 삭제되며 복구할 수 없습니다.</p><div><button type="button" className="button button-outline" disabled={busy} onClick={() => setConfirmId(null)}>취소</button><button type="button" className="button button-reject" disabled={busy} onClick={() => void removePost(post)}>{deletingId === post.id ? "삭제 중…" : "글 삭제 확정"}</button></div></div>}
        {expanded && <div className="admin-post-comments" id={`admin-post-comments-${post.id}`}>
          {thread?.loading && <p className="admin-post-comments-status" role="status">댓글을 불러오고 있습니다…</p>}
          {thread?.error && <p className="admin-error" role="alert">{thread.error}</p>}
          {thread && !thread.loading && !thread.error && thread.items.length === 0 && <p className="admin-post-comments-status">아직 댓글이 없습니다.</p>}
          {thread && thread.items.length > 0 && <ul>{thread.items.map(comment => <li key={comment.id}>
            <div className="admin-post-comment-meta"><strong>{authorLabel(comment)}</strong><time dateTime={comment.createdAt}>{postDateTime(comment.createdAt)}</time></div>
            <p>{comment.content}</p>
            {commentConfirmId === comment.id ? <div className="admin-review-delete-confirm"><p>이 댓글을 삭제할까요? 복구할 수 없습니다.</p><div><button type="button" className="button button-outline" disabled={busy} onClick={() => setCommentConfirmId(null)}>취소</button><button type="button" className="button button-reject" disabled={busy} onClick={() => void removeComment(post, comment)}>{deletingCommentId === comment.id ? "삭제 중…" : "댓글 삭제 확정"}</button></div></div> : <button type="button" className="admin-review-delete" disabled={busy} onClick={() => { setCommentConfirmId(comment.id); setConfirmId(null); }}>댓글 삭제</button>}
          </li>)}</ul>}
        </div>}
      </article>;
    })}</div>
    <div className="admin-pagination"><button type="button" disabled={page === 0 || loading || busy} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(list.total / pageSize))}</span><button type="button" disabled={(page + 1) * pageSize >= list.total || loading || busy} onClick={() => setPage(value => value + 1)}>다음</button></div>
  </section>;
}
