"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { announcePostChange, postCategories, rememberPostToken, writePost, type PostCategory } from "@/lib/posts";
import { useAuth } from "../auth-provider";

export function PostForm({ initialCategory = "FREE" }: { initialCategory?: PostCategory }) {
  const id = useId();
  const router = useRouter();
  const { member, ready } = useAuth();
  const [category, setCategory] = useState<PostCategory>(initialCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tokenWarning, setTokenWarning] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (title.trim().length < 2 || content.trim().length < 5) { setError("제목은 2자 이상, 내용은 5자 이상으로 작성해 주세요."); return; }
    setBusy(true);
    try {
      const result = await writePost({ category, title: title.trim(), content: content.trim() });
      const saved = result.deleteToken ? rememberPostToken(result.post.id, result.deleteToken) : true;
      announcePostChange();
      if (!saved && result.deleteToken) { setTokenWarning(result.deleteToken); setBusy(false); return; }
      router.push(`/community/${encodeURIComponent(result.post.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "글을 등록하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  if (tokenWarning) return <div className="review-success" role="status">
    <h3>글을 올렸어요.</h3>
    <p className="review-storage-warning">이 브라우저에 삭제 코드를 저장하지 못했어요. 아래 코드를 꼭 보관해 주세요. 글의 ‘삭제’에서 사용할 수 있어요.</p>
    <div className="review-recovery-row"><input aria-label="내 글 삭제 코드" readOnly value={tokenWarning} onFocus={event => event.currentTarget.select()} /></div>
    <div className="review-success-actions"><Link className="review-button review-button-primary" href="/community">글 목록으로</Link></div>
  </div>;

  return <form className="review-form post-form" onSubmit={submit} aria-label="소통 글 작성">
    <fieldset className="post-form-categories" disabled={busy}><legend>주제</legend><div>{postCategories.map(([value, label]) => <label key={value} className={category === value ? "active" : ""}><input type="radio" name={`${id}-category`} value={value} checked={category === value} onChange={() => setCategory(value)} />{label}</label>)}</div></fieldset>
    <div className="review-field"><label htmlFor={`${id}-title`}>제목</label><input id={`${id}-title`} value={title} onChange={event => setTitle(event.target.value)} placeholder="무슨 이야기를 나누고 싶나요?" minLength={2} maxLength={100} required disabled={busy} aria-describedby={`${id}-title-count`} /><span className="review-character-count" id={`${id}-title-count`}>{title.length}/100</span></div>
    <div className="review-field"><label htmlFor={`${id}-content`}>내용</label><textarea id={`${id}-content`} value={content} onChange={event => setContent(event.target.value)} placeholder={"부업하면서 겪은 일, 궁금한 점, 팁을 자유롭게 적어 주세요.\n이름·연락처 같은 개인정보와 광고·욕설은 넣지 말아 주세요."} minLength={5} maxLength={5000} required disabled={busy} rows={10} aria-describedby={`${id}-content-count`} /><span className="review-character-count" id={`${id}-content-count`}>{content.length.toLocaleString()}/5,000</span></div>
    <div className="review-writing-note">{member ? <><strong>{member.nickname} 님 닉네임으로 올라가요.</strong><p>회원 글은 로그인한 상태에서 삭제 코드 없이 바로 지울 수 있어요.</p></> : <><strong>ㅇㅇ(IP 앞자리) 익명으로 올라가요.</strong><p>디시처럼 글쓴이는 <b>ㅇㅇ(118.235)</b> 형태로 표시되고, 이 브라우저에 저장되는 삭제 코드로 내 글을 지울 수 있어요. {ready && <Link href="/login?next=/community/write">로그인</Link>}하면 닉네임으로 올라가요.</p></>}</div>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions"><span>{member ? `${member.nickname} 닉네임으로 공개됩니다` : "ㅇㅇ(IP) 익명으로 공개됩니다"}</span><button type="submit" className="review-button review-button-primary" disabled={busy}>{busy ? "올리는 중…" : "글 올리기"}</button></div>
  </form>;
}
