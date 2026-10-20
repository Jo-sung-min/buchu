"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { announcePostChange, discardPostImage, postCategories, postImageLimit, postImageMaxBytes, postImageTypes, rememberPostToken, uploadPostImage, writePost, type PostCategory, type PostImageRef } from "@/lib/posts";
import { useAuth } from "../auth-provider";
import { Icon } from "../icons";

/** A photo picked in the form: uploading, uploaded (has `ref`), or failed (has `error`). */
type PhotoDraft = { key: string; name: string; preview: string; progress: number; ref?: PostImageRef; error?: string; controller: AbortController };

export function PostForm({ initialCategory = "FREE" }: { initialCategory?: PostCategory }) {
  const id = useId();
  const router = useRouter();
  const { member, ready } = useAuth();
  const [category, setCategory] = useState<PostCategory>(initialCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tokenWarning, setTokenWarning] = useState("");
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const uploading = photos.some(photo => !photo.ref && !photo.error);

  // Preview addresses are browser objects; release them when the form goes away.
  useEffect(() => () => { photosRef.current.forEach(photo => { photo.controller.abort(); URL.revokeObjectURL(photo.preview); }); }, []);

  function patch(key: string, change: Partial<PhotoDraft>) {
    setPhotos(current => current.map(photo => photo.key === key ? { ...photo, ...change } : photo));
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    const room = postImageLimit - photos.length;
    if (room <= 0) { setError(`사진은 최대 ${postImageLimit}장까지 붙일 수 있어요.`); return; }
    const rejected = files.find(file => !postImageTypes.includes(file.type) || file.size > postImageMaxBytes || file.size === 0);
    if (rejected) { setError(!postImageTypes.includes(rejected.type) ? "JPG, PNG, WebP, GIF 사진만 올릴 수 있어요." : "사진은 한 장에 8MB 이하여야 해요."); return; }
    if (files.length > room) setError(`사진은 최대 ${postImageLimit}장까지라 앞의 ${room}장만 올려요.`);
    const added = files.slice(0, room).map<PhotoDraft>(file => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, preview: URL.createObjectURL(file), progress: 0, controller: new AbortController() }));
    setPhotos(current => [...current, ...added]);
    added.forEach((draft, index) => {
      uploadPostImage(files[index], fraction => patch(draft.key, { progress: fraction }), draft.controller.signal)
        .then(ref => patch(draft.key, { ref, progress: 1 }))
        .catch(cause => { if (!draft.controller.signal.aborted) patch(draft.key, { error: cause instanceof Error ? cause.message : "사진을 올리지 못했어요." }); });
    });
  }

  function removePhoto(key: string) {
    const photo = photos.find(item => item.key === key);
    if (!photo) return;
    photo.controller.abort();
    URL.revokeObjectURL(photo.preview);
    if (photo.ref) void discardPostImage(photo.ref);
    setPhotos(current => current.filter(item => item.key !== key));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (title.trim().length < 2 || content.trim().length < 5) { setError("제목은 2자 이상, 내용은 5자 이상으로 작성해 주세요."); return; }
    if (uploading) { setError("사진 업로드가 끝날 때까지 잠시만 기다려 주세요."); return; }
    if (photos.some(photo => photo.error)) { setError("올리지 못한 사진은 지우거나 다시 올려 주세요."); return; }
    setBusy(true);
    try {
      const result = await writePost({ category, title: title.trim(), content: content.trim(), images: photos.flatMap(photo => photo.ref ? [photo.ref] : []) });
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
    <div className="review-field post-form-photos">
      <label htmlFor={`${id}-photos`}>사진 <small>선택 · 최대 {postImageLimit}장, 장당 8MB</small></label>
      <ul className="post-photo-list" aria-live="polite">
        {photos.map(photo => <li key={photo.key} className={`post-photo${photo.error ? " has-error" : photo.ref ? " is-done" : " is-uploading"}`}>
          <img src={photo.preview} alt={photo.name} />
          {!photo.ref && !photo.error && <span className="post-photo-progress" role="progressbar" aria-label={`${photo.name} 올리는 중`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(photo.progress * 100)}><i style={{ width: `${Math.max(4, Math.round(photo.progress * 100))}%` }} /></span>}
          {photo.error && <span className="post-photo-error" role="alert" title={photo.error}>실패</span>}
          <button type="button" className="post-photo-remove" onClick={() => removePhoto(photo.key)} aria-label={`${photo.name} 빼기`} disabled={busy}><Icon name="close" size={12} /></button>
        </li>)}
        {photos.length < postImageLimit && <li className="post-photo-add"><label><input id={`${id}-photos`} type="file" accept={postImageTypes.join(",")} multiple onChange={addPhotos} disabled={busy} /><Icon name="plus" size={18} /><span>사진 추가</span><small>{photos.length}/{postImageLimit}</small></label></li>}
      </ul>
      {photos.some(photo => photo.error) && <p className="post-photo-hint">{photos.find(photo => photo.error)?.error} 빼고 다시 올려 주세요.</p>}
    </div>
    <div className="review-writing-note">{member ? <><strong>{member.nickname} 님 닉네임으로 올라가요.</strong><p>회원 글은 로그인한 상태에서 삭제 코드 없이 바로 지울 수 있어요.</p></> : <><strong>ㅇㅇ(IP 앞자리) 익명으로 올라가요.</strong><p>디시처럼 글쓴이는 <b>ㅇㅇ(118.235)</b> 형태로 표시되고, 이 브라우저에 저장되는 삭제 코드로 내 글을 지울 수 있어요. {ready && <Link href="/login?next=/community/write">로그인</Link>}하면 닉네임으로 올라가요.</p></>}</div>
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions"><span>{member ? `${member.nickname} 닉네임으로 공개됩니다` : "ㅇㅇ(IP) 익명으로 공개됩니다"}</span><button type="submit" className="review-button review-button-primary" disabled={busy || uploading}>{busy ? "올리는 중…" : uploading ? "사진 올리는 중…" : "글 올리기"}</button></div>
  </form>;
}
