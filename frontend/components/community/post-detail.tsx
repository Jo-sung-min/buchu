"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { announcePostChange, authorInitial, authorLabel, deleteComment, deletePost, fetchComments, fetchPost, getPostToken, postCategoryLabels, postDateTime, postTime, rememberPostToken, writeComment, type Post, type PostComment } from "@/lib/posts";
import { useAuth } from "../auth-provider";
import { Icon } from "../icons";

function DeleteControl({ label, owned, busy, onDelete }: { label: string; owned: boolean; busy: boolean; onDelete: (token?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  async function run() {
    setError("");
    try { await onDelete(owned ? undefined : manual.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "삭제하지 못했어요."); }
  }
  return <>
    <button type="button" className="post-delete-trigger" onClick={() => { setOpen(!open); setError(""); }}>{owned ? `내 ${label} 삭제` : "삭제"}</button>
    {open && <div className="review-delete-panel post-delete-panel"><strong>이 {label}을 삭제할까요?</strong><p>삭제한 {label}은 되돌릴 수 없어요.{!owned && " 작성할 때 받은 삭제 코드가 필요해요."}</p>{!owned && <input type="password" aria-label={`${label} 삭제 코드`} value={manual} onChange={event => setManual(event.target.value)} placeholder="삭제 코드" autoComplete="off" disabled={busy} />}{error && <p className="review-error" role="alert">{error}</p>}<div><button type="button" className="review-button review-button-quiet" disabled={busy} onClick={() => setOpen(false)}>취소</button><button type="button" className="review-button review-button-primary" disabled={busy || (!owned && !manual.trim())} onClick={run}>{busy ? "삭제하는 중…" : `${label} 삭제`}</button></div></div>}
  </>;
}

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const { member } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [ownToken, setOwnToken] = useState<string | undefined>();
  const [ownComments, setOwnComments] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => { setOwnToken(getPostToken(id)); }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([fetchPost(id, controller.signal), fetchComments(id, controller.signal)])
      .then(([nextPost, nextComments]) => {
        setPost(nextPost); setComments(nextComments);
        setOwnComments(Object.fromEntries(nextComments.flatMap(comment => { const token = getPostToken(comment.id); return token ? [[comment.id, token]] : []; })));
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        if (cause && typeof cause === "object" && "status" in cause && (cause as { status: number }).status === 404) setMissing(true);
        else setError(cause instanceof Error ? cause.message : "글을 불러오지 못했어요.");
      });
    return () => controller.abort();
  }, [id, version]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true); setCommentError("");
    try {
      const result = await writeComment(id, draft.trim());
      if (result.deleteToken) { rememberPostToken(result.comment.id, result.deleteToken); setOwnComments(current => ({ ...current, [result.comment.id]: result.deleteToken })); }
      setComments(current => [...(current || []), result.comment]);
      setPost(current => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      setDraft("");
      announcePostChange();
    } catch (cause) { setCommentError(cause instanceof Error ? cause.message : "댓글을 등록하지 못했어요."); }
    finally { setBusy(false); }
  }

  async function removePost(token?: string) {
    const value = token || ownToken || (post?.mine ? "session" : undefined);
    if (!value) throw new Error("삭제 코드를 입력해 주세요.");
    setBusy(true);
    try { await deletePost(id, value); router.push("/community"); }
    finally { setBusy(false); }
  }

  async function removeComment(commentId: string, token?: string) {
    const value = token || ownComments[commentId] || (comments?.find(comment => comment.id === commentId)?.mine ? "session" : undefined);
    if (!value) throw new Error("삭제 코드를 입력해 주세요.");
    setBusy(true);
    try {
      await deleteComment(commentId, value);
      setComments(current => (current || []).filter(comment => comment.id !== commentId));
      setPost(current => current ? { ...current, commentCount: Math.max(0, current.commentCount - 1) } : current);
    } finally { setBusy(false); }
  }

  if (missing) return <div className="home-empty"><h3>글을 찾을 수 없어요</h3><p>삭제됐거나 주소가 잘못됐을 수 있어요.</p><Link href="/community">소통 홈으로 <Icon name="arrow" size={15} /></Link></div>;
  if (error) return <div className="home-empty"><h3>글을 불러오지 못했어요</h3><p>{error}</p><button onClick={() => setVersion(value => value + 1)}>다시 불러오기</button></div>;
  if (!post) return <div className="home-loading" role="status">글 불러오는 중…</div>;

  return <article className="post-detail">
    <header className="post-detail-head">
      <span className="post-detail-category">{postCategoryLabels[post.category] || post.category}</span>
      <h1>{post.title}</h1>
      <div className="post-detail-meta"><span className={`home-row-avatar-anon${post.authorType === "MEMBER" ? " is-member" : ""}`} aria-hidden="true">{authorInitial(post)}</span><span className={`post-author${post.authorType === "MEMBER" ? " is-member" : ""}`}>{authorLabel(post)}{post.authorType === "MEMBER" && <small>회원</small>}</span><span className="review-meta-dot" aria-hidden="true">·</span><time dateTime={post.createdAt} title={postDateTime(post.createdAt)}>{postTime(post.createdAt)}</time><span className="review-meta-dot" aria-hidden="true">·</span><span><Icon name="eye" size={13} /> {post.viewCount}</span><span><Icon name="comment" size={13} /> {post.commentCount}</span></div>
    </header>
    <div className="post-detail-body">{post.content}</div>
    <div className="post-detail-actions"><Link href="/community" className="review-button review-button-quiet">목록</Link><DeleteControl label="글" owned={Boolean(ownToken) || post.mine} busy={busy} onDelete={removePost} /></div>
    <section className="post-comments" aria-labelledby="comments-title">
      <h2 id="comments-title">댓글 <span>{post.commentCount}</span></h2>
      {comments?.length ? <ol>{comments.map(comment => <li key={comment.id} className="post-comment">
        <div className="post-comment-meta"><span className={`home-row-avatar-anon${comment.authorType === "MEMBER" ? " is-member" : ""}`} aria-hidden="true">{authorInitial(comment)}</span><strong className={comment.authorType === "MEMBER" ? "is-member" : ""}>{authorLabel(comment)}</strong><time dateTime={comment.createdAt} title={postDateTime(comment.createdAt)}>{postTime(comment.createdAt)}</time></div>
        <p>{comment.content}</p>
        <div className="post-comment-actions"><DeleteControl label="댓글" owned={Boolean(ownComments[comment.id]) || comment.mine} busy={busy} onDelete={token => removeComment(comment.id, token)} /></div>
      </li>)}</ol> : <p className="post-comments-empty">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>}
      <form className="post-comment-form" onSubmit={submitComment} aria-label="댓글 작성">
        <textarea aria-label="댓글 내용" value={draft} onChange={event => setDraft(event.target.value)} placeholder={member ? `${member.nickname} 님으로 댓글을 남겨요` : "ㅇㅇ(IP) 익명으로 댓글을 남겨요"} maxLength={1000} rows={3} disabled={busy} required />
        {commentError && <p className="review-error" role="alert">{commentError}</p>}
        <div><span>{draft.length.toLocaleString()}/1,000</span><button type="submit" className="review-button review-button-primary" disabled={busy || !draft.trim()}>{busy ? "등록 중…" : "댓글 등록"}</button></div>
      </form>
    </section>
  </article>;
}
