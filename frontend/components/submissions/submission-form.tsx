"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DetailContent } from "@/components/detail-content";
import {
  api, editableSubmission, emptySubmission, helpTypeLabels, richText, submissionBoardLabels, submissionHeaders, submissionStatusLabel, uploadImage,
  type DraftCredentials, type Submission, type SubmissionBoard, type SubmissionChannel, type SubmissionInput, type UploadedImage,
} from "@/lib/submissions";

const DetailEditor = dynamic(() => import("./detail-editor"), { ssr: false, loading: () => <div className="editor-loading">상세페이지 편집기를 준비하고 있어요…</div> });
const STORAGE_KEY = "buchu:submission:v1";
const channelLabels: Record<SubmissionChannel, string> = { blog: "블로그", sns: "인스타그램 · SNS", video: "유튜브 · 영상", website: "웹사이트" };

function validCredentials(value: unknown): value is DraftCredentials {
  return !!value && typeof value === "object" && "id" in value && "accessToken" in value && typeof value.id === "string" && value.id.length > 0 && value.id.length < 100 && typeof value.accessToken === "string" && value.accessToken.length >= 16 && value.accessToken.length < 500;
}

function newSubmission(board: SubmissionBoard): SubmissionInput {
  return { ...emptySubmission, board, category: board === "HELP" ? "campaign" : "affiliate", channels: board === "HELP" ? ["website"] : [] };
}

export default function SubmissionForm({ initialBoard = "MARKETER" }: { initialBoard?: SubmissionBoard }) {
  const [form, setForm] = useState<SubmissionInput>(() => newSubmission(initialBoard));
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [credentials, setCredentials] = useState<DraftCredentials | null>(null);
  const credentialsRef = useRef<DraftCredentials | null>(null);
  const draftPromise = useRef<Promise<DraftCredentials> | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const thumbnailInput = useRef<HTMLInputElement>(null);
  const readOnly = submission?.status === "PENDING" || submission?.status === "APPROVED";
  const locked = loading || busy || uploading || readOnly || restoreFailed;
  const isHelp = form.board === "HELP";

  const remember = (value: DraftCredentials) => {
    credentialsRef.current = value;
    setCredentials(value);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    catch { setStorageWarning("이 브라우저에는 신청 정보를 보관할 수 없어요. 계속 작성하려면 복구 코드를 따로 저장해 주세요."); }
  };

  const applySubmission = (value: Submission) => {
    setRestoreFailed(false);
    setSubmission(value);
    setForm(editableSubmission(value));
    setTagInput((value.tags ?? []).join(", "));
    setThumbnailUrl(value.thumbnailUrl ?? "");
    setLastSavedAt(value.updatedAt);
    setDirty(false);
  };

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        let saved: unknown;
        try { saved = JSON.parse(stored); } catch { sessionStorage.removeItem(STORAGE_KEY); return; }
        if (!validCredentials(saved)) { sessionStorage.removeItem(STORAGE_KEY); return; }
        if (mounted) remember(saved);
        const value = await api<Submission>(`/api/submissions/${encodeURIComponent(saved.id)}`, { headers: submissionHeaders(saved) });
        if (mounted) { remember(saved); applySubmission(value); }
      } catch (cause) {
        if (mounted) { setError(cause instanceof Error ? cause.message : "신청서를 불러오지 못했어요."); setRecoveryOpen(true); setRestoreFailed(true); }
      } finally { if (mounted) setLoading(false); }
    };
    void restore();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, uploading]);

  const update = <K extends keyof SubmissionInput>(key: K, value: SubmissionInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
  };

  const changeBoard = (board: SubmissionBoard) => {
    setForm((current) => ({ ...current, board, category: board === "HELP" ? "campaign" : current.category, channels: board === "HELP" && !current.channels.length ? ["website"] : current.channels }));
    setDirty(true);
    setMessage("");
  };

  const ensureDraft = async () => {
    if (credentialsRef.current) return credentialsRef.current;
    if (draftPromise.current) return draftPromise.current;
    draftPromise.current = api<DraftCredentials & { status: "DRAFT" }>("/api/submissions/drafts", { method: "POST" }).then((created) => {
      const value = { id: created.id, accessToken: created.accessToken };
      remember(value);
      return value;
    }).finally(() => { draftPromise.current = null; });
    return draftPromise.current;
  };

  const upload = async (file: File): Promise<UploadedImage> => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG, WebP 이미지만 등록할 수 있어요.");
    if (file.size > 8 * 1024 * 1024 || !file.size) throw new Error("이미지는 0바이트보다 크고 8MB 이하여야 해요.");
    setUploading(true);
    setError("");
    setMessage("");
    try { return await uploadImage(await ensureDraft(), file); }
    finally { setUploading(false); }
  };

  const uploadThumbnail = async (file: File) => {
    try {
      const image = await upload(file);
      update("thumbnailUploadId", image.uploadId);
      setThumbnailUrl(image.url);
      setMessage("대표 이미지를 등록했어요. 임시 저장으로 신청서에도 반영해 주세요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "대표 이미지를 등록하지 못했어요."); }
  };

  const save = async (submit: boolean) => {
    setError("");
    setMessage("");
    if (submit) {
      if (!form.channels.length) { setError("참여 가능한 채널을 하나 이상 선택해 주세요."); document.getElementById("submission-channels")?.focus(); return; }
      if (!form.thumbnailUploadId) { setError("프로그램을 소개할 대표 이미지를 등록해 주세요."); thumbnailInput.current?.focus(); return; }
      const hasImage = JSON.stringify(form.content).includes('"type":"image"');
      if (!richText(form.content).trim() && !hasImage) { setError("상세페이지에 소개 내용이나 이미지를 추가해 주세요."); return; }
    }
    setBusy(true);
    try {
      const owner = await ensureDraft();
      const base = `/api/submissions/${encodeURIComponent(owner.id)}`;
      const tags = [...new Set(tagInput.split(",").map((tag) => tag.trim()).filter(Boolean))];
      if (tags.length > 10 || tags.some((tag) => tag.length > 30)) throw new Error("태그는 각 30자 이내로 최대 10개까지 입력해 주세요.");
      const saved = await api<Submission>(base, { method: "PUT", headers: submissionHeaders(owner), body: JSON.stringify({ ...form, tags }) });
      applySubmission(saved);
      if (submit) {
        const sent = await api<Submission>(`${base}/submit`, { method: "POST", headers: submissionHeaders(owner) });
        applySubmission(sent);
        setMessage("게재 신청을 접수했어요. 검토 결과는 이 페이지에서 확인할 수 있어요.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setMessage("신청서를 임시 저장했어요. 복구 코드를 보관하면 다른 브라우저에서도 이어 쓸 수 있어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "신청서를 저장하지 못했어요."); }
    finally { setBusy(false); }
  };

  const resume = async () => {
    const parts = recoveryCode.trim().split(":");
    const owner = { id: parts[0], accessToken: parts[1] };
    if (parts.length !== 2 || !validCredentials(owner)) { setError("복구 코드 전체를 정확하게 입력해 주세요."); return; }
    if (dirty && !window.confirm("현재 저장하지 않은 내용을 닫고 신청서를 불러올까요?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const value = await api<Submission>(`/api/submissions/${encodeURIComponent(owner.id)}`, { headers: submissionHeaders(owner) });
      remember(owner); applySubmission(value); setRecoveryOpen(false); setRecoveryCode(""); setConsent(false);
      setMessage("신청서를 불러왔어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "신청서를 불러오지 못했어요."); }
    finally { setBusy(false); }
  };

  const refresh = async () => {
    if (!credentials) return;
    setBusy(true); setError("");
    try {
      applySubmission(await api<Submission>(`/api/submissions/${encodeURIComponent(credentials.id)}`, { headers: submissionHeaders(credentials) }));
      setMessage("최신 검토 상태를 확인했어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "상태를 확인하지 못했어요."); }
    finally { setBusy(false); }
  };

  const newApplication = () => {
    if (!window.confirm("새 신청서를 작성할까요? 기존 신청서는 복구 코드로 다시 확인할 수 있어요. 복구 코드를 먼저 보관해 주세요.")) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* In-memory credentials still reset. */ }
    credentialsRef.current = null;
    setCredentials(null); setSubmission(null); setForm(newSubmission(initialBoard)); setTagInput(""); setThumbnailUrl("");
    setDirty(false); setConsent(false); setLastSavedAt(null); setMessage(""); setError(""); setRestoreFailed(false);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!locked) void save(true); };
  const completed = [Boolean(form.companyName && form.contactName && form.contactEmail), Boolean(form.name && form.officialUrl && form.channels.length && form.commission && form.settlement), Boolean(form.thumbnailUploadId), Boolean(richText(form.content).trim() || JSON.stringify(form.content).includes('"type":"image"'))];

  return <div className="submission-page">
    <section className="submission-hero"><div className="container"><Link className="submission-back" href={isHelp ? "/help" : "/"}>← 게시판으로</Link><h1>기업 게재 신청</h1></div></section>
    <div className="container submission-workspace">
      <div className="submission-main">
        <div className="submission-workspace-heading"><div><h2>{readOnly ? "신청 현황" : "게재 신청서"}</h2></div><button type="button" className="submission-text-button" disabled={busy || uploading} onClick={() => setRecoveryOpen(!recoveryOpen)}>기존 신청 불러오기 ↗</button></div>
        {recoveryOpen && <div className="submission-recovery"><h3>저장해 둔 신청서가 있나요?</h3><p>신청할 때 보관한 복구 코드를 입력해 주세요.</p><label htmlFor="recovery-code">신청서 복구 코드</label><div className="submission-inline-input"><input id="recovery-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} placeholder="신청 번호:복구 키" autoComplete="off" spellCheck={false} /><button type="button" className="button button-green" disabled={busy || uploading || !recoveryCode.trim()} onClick={() => void resume()}>불러오기</button></div></div>}
        {loading && <div className="submission-alert" role="status">저장된 신청서를 확인하고 있어요…</div>}
        {error && <div className="submission-alert error" role="alert">{error}</div>}
        {restoreFailed && credentials && <div className="submission-alert"><p>기존 신청서를 불러올 때까지 편집을 잠시 멈췄어요. 내용을 다시 확인해 주세요.</p><button type="button" className="button button-outline" disabled={busy} onClick={() => void refresh()}>신청서 다시 불러오기</button></div>}
        {message && <div className="submission-alert success" role="status">{message}</div>}
        {storageWarning && <div className="submission-alert" role="status">{storageWarning}</div>}
        {submission && <div className={`submission-status-card status-${submission.status.toLowerCase()}`}>
          <div><span className="submission-status-badge">{submissionStatusLabel[submission.status]}</span><h3>{submission.status === "PENDING" ? "신청이 잘 도착했어요." : submission.status === "APPROVED" ? "이제 부추에서 만날 수 있어요." : submission.status === "REJECTED" ? "몇 가지만 보완해 주세요." : "천천히 완성해도 괜찮아요."}</h3><p>{submission.status === "PENDING" ? "운영자가 프로그램 내용과 참여 조건을 확인하고 있어요. 검토 중에는 신청서를 수정할 수 없어요." : submission.status === "APPROVED" ? "소개 페이지가 공개되었어요. 아래 링크에서 확인할 수 있어요." : submission.status === "REJECTED" ? "운영자의 검토 의견을 확인하고 수정한 뒤 다시 신청해 주세요." : "임시 저장한 내용은 공개되지 않아요. 작성이 끝나면 게재 신청을 눌러 주세요."}</p></div>
          {submission.reviewNote && <div className="submission-review-note"><strong>운영자 검토 의견</strong><p>{submission.reviewNote}</p></div>}
          {readOnly && <div className="submission-status-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => void refresh()}>검토 상태 새로고침</button>{submission.publishedSlug && <Link className="button button-green" href={`/${submission.board === "HELP" ? "help" : "programs"}/${encodeURIComponent(submission.publishedSlug)}`}>게시된 소개 보기 ↗</Link>}</div>}
        </div>}
        {credentials && <details className="submission-secret"><summary>신청서 복구 코드 보관하기 <span>다음에 이어 쓰거나 검토 결과를 확인할 때 필요해요</span></summary><p>이 코드를 가진 사람은 신청서를 열 수 있어요. 담당자만 보관해 주세요. 브라우저 탭을 닫으면 자동 복구 정보가 사라질 수 있어요.</p><div className="submission-inline-input"><input aria-label="현재 신청서 복구 코드" readOnly value={`${credentials.id}:${credentials.accessToken}`} onFocus={(event) => event.target.select()} /><button type="button" className="button button-outline" onClick={async () => {
          try { await navigator.clipboard.writeText(`${credentials.id}:${credentials.accessToken}`); setMessage("복구 코드를 복사했어요. 안전한 곳에 보관해 주세요."); }
          catch { setMessage("코드 입력란을 선택해 직접 복사해 주세요."); }
        }}>코드 복사</button></div></details>}

        {!readOnly ? <form onSubmit={onSubmit} className="submission-form">
          <fieldset disabled={locked} className="submission-section submission-board-section"><legend>게시판 선택</legend><p className="submission-section-help">게시판을 선택하세요.</p><div className="submission-board-options">{(["MARKETER", "HELP"] as SubmissionBoard[]).map((board) => <label key={board} className={form.board === board ? "selected" : ""}><input type="radio" name="submissionBoard" value={board} checked={form.board === board} onChange={() => changeBoard(board)} /><span><strong>{submissionBoardLabels[board]}</strong><small>{board === "MARKETER" ? "제휴마케팅 · 부업 프로그램" : "기업 홍보 · 인재·협업 모집"}</small></span></label>)}</div></fieldset>
          <fieldset disabled={locked} className="submission-section" id="company-info"><legend><span>01</span>기업 · 담당자 정보</legend><p className="submission-section-help">기업명은 승인 후 소개 페이지에 공개돼요. 사업자등록번호와 담당자 이름·이메일·연락처는 검토와 문의에만 사용하며 공개하지 않아요.</p><div className="submission-field-grid">
            <Field label="기업명" name="companyName" value={form.companyName} required maxLength={120} placeholder="사업자 또는 기업 이름" onChange={(value) => update("companyName", value)} />
            <Field label="사업자등록번호" name="businessNumber" value={form.businessNumber} maxLength={30} placeholder="000-00-00000 (선택)" onChange={(value) => update("businessNumber", value)} />
            <Field label="담당자 이름" name="contactName" value={form.contactName} required maxLength={80} autoComplete="name" placeholder="검토 연락을 받을 담당자" onChange={(value) => update("contactName", value)} />
            <Field label="담당자 이메일" name="contactEmail" value={form.contactEmail} required type="email" maxLength={254} autoComplete="email" placeholder="partner@example.com" onChange={(value) => update("contactEmail", value)} />
            <Field label="담당자 연락처" name="contactPhone" value={form.contactPhone} type="tel" maxLength={40} autoComplete="tel" placeholder="010-0000-0000 (선택)" onChange={(value) => update("contactPhone", value)} />
          </div></fieldset>
          <fieldset disabled={locked} className="submission-section" id="program-info"><legend><span>02</span>{isHelp ? "홍보 · 모집 내용" : "프로그램 소개"}</legend><p className="submission-section-help">참여 방법과 보상·지급 조건을 작성하세요.</p><div className="submission-field-grid">
            <Field label={isHelp ? "모집 · 홍보 제목" : "프로그램 이름"} name="programName" value={form.name} required maxLength={120} placeholder={isHelp ? "예: 신제품을 소개할 콘텐츠 파트너를 찾아요" : "예: 우리브랜드 파트너스"} onChange={(value) => update("name", value)} />
            {isHelp ? <label className="submission-field" htmlFor="helpType"><span>등록 목적 <Required /></span><select id="helpType" value={form.helpType} onChange={(event) => update("helpType", event.target.value as SubmissionInput["helpType"])}><option value="PROMOTION">홍보 · 마케팅</option><option value="RECRUITMENT">인재 · 협업 모집</option></select></label> : <label className="submission-field" htmlFor="category"><span>프로그램 유형 <Required /></span><select id="category" value={form.category} onChange={(event) => update("category", event.target.value as SubmissionInput["category"])}><option value="affiliate">링크 기반 제휴마케팅</option><option value="campaign">캠페인 · 콘텐츠 마케팅</option></select></label>}
            {isHelp && <><Field label="활동 지역" name="location" value={form.location} maxLength={120} placeholder="예: 전국 · 원격 가능 / 서울 성수동" onChange={(value) => update("location", value)} /><Field label="모집 기한 (선택)" name="deadline" value={form.deadline ?? ""} type="date" onChange={(value) => update("deadline", value || null)} /></>}
            <Field label="한 줄 소개" name="tagline" value={form.tagline} required maxLength={180} placeholder="어떤 기회인지 한 문장으로 소개해 주세요" wide onChange={(value) => update("tagline", value)} />
            <label className="submission-field full-width" htmlFor="description"><span>{isHelp ? "요청 내용 요약" : "프로그램 요약"} <Required /></span><textarea id="description" value={form.description} required maxLength={1000} rows={3} placeholder={isHelp ? "업무, 모집 대상, 참여 방법을 짧게 설명해 주세요." : "서비스의 특징, 참여 방식, 추천 대상을 짧게 설명해 주세요."} onChange={(event) => update("description", event.target.value)} /><small>{form.description.length.toLocaleString()} / 1,000자</small></label>
            <Field label={isHelp ? "문의 · 지원 링크" : "공식 사이트 주소"} name="officialUrl" value={form.officialUrl} required type="url" maxLength={2000} placeholder="https://example.com/partners" wide onChange={(value) => update("officialUrl", value)} />
            {!isHelp && <div className="submission-field full-width" id="submission-channels" tabIndex={-1}><span>참여 가능한 채널 <Required /></span><div className="submission-channel-options">{(Object.entries(channelLabels) as [SubmissionChannel, string][]).map(([channel, label]) => <label key={channel} className={form.channels.includes(channel) ? "selected" : ""}><input type="checkbox" checked={form.channels.includes(channel)} onChange={(event) => update("channels", event.target.checked ? [...form.channels, channel] : form.channels.filter((current) => current !== channel))} /><span>{label}</span></label>)}</div></div>}
            <label className="submission-field" htmlFor="cost"><span>참여 비용 <Required /></span><select id="cost" value={form.cost} onChange={(event) => { update("cost", event.target.value as SubmissionInput["cost"]); update("costLabel", event.target.value === "free" ? "무료 시작" : "참여 조건 확인"); }}><option value="free">무료로 시작할 수 있어요</option><option value="check">비용 · 조건 확인이 필요해요</option></select></label>
            <Field label="비용 안내 문구" name="costLabel" value={form.costLabel} maxLength={120} placeholder="예: 가입비 무료 · 추가 비용 없음" onChange={(value) => update("costLabel", value)} />
            <Field label={isHelp ? "보상 조건" : "수익 · 보상 기준"} name="commission" value={form.commission} required maxLength={300} placeholder={isHelp ? "예: 콘텐츠 1건 10만 원 / 협의 후 결정" : "예: 구매 확정 금액의 3%"} onChange={(value) => update("commission", value)} />
            <Field label={isHelp ? "지급 조건" : "정산 기준"} name="settlement" value={form.settlement} required maxLength={300} placeholder={isHelp ? "예: 콘텐츠 검수 완료 후 7일 이내 지급" : "예: 매월 15일 · 1만 원 이상"} onChange={(value) => update("settlement", value)} />
            <Field label="검색 태그" name="tags" value={tagInput} maxLength={320} placeholder="예: 생활용품, 초보 추천, 링크 공유 (쉼표로 구분)" wide onChange={(value) => { setTagInput(value); setDirty(true); }} />
          </div></fieldset>
          <fieldset disabled={locked} className="submission-section" id="cover-image"><legend><span>03</span>대표 이미지 <Required /></legend><p className="submission-section-help">목록과 상세페이지에 표시되는 이미지입니다.</p><div className={`submission-upload-box ${thumbnailUrl ? "has-image" : ""}`}>
            {thumbnailUrl ? <img src={thumbnailUrl} alt="등록한 대표 이미지" className="submission-thumbnail" /> : <div className="submission-upload-symbol" aria-hidden="true">▧</div>}
            <div><strong>{thumbnailUrl ? "대표 이미지 등록됨" : "대표 이미지 선택"}</strong><p>가로형 이미지 권장 · JPG, PNG, WebP · 최대 8MB</p><label className="button button-outline submission-upload-button">{uploading ? "이미지 전송 중…" : thumbnailUrl ? "이미지 변경" : "이미지 선택"}<input ref={thumbnailInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="대표 이미지 등록" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadThumbnail(file); }} /></label></div>
          </div></fieldset>
          <section className="submission-section" id="detail-content" aria-labelledby="detail-content-heading"><h3 className="submission-section-title" id="detail-content-heading"><span>04</span>상세페이지 <Required /></h3><p className="submission-section-help">소개와 참여 조건을 작성하고 필요한 이미지를 추가하세요.</p><DetailEditor value={form.content} onChange={(value) => update("content", value)} onImageUpload={upload} disabled={locked} uploading={uploading} /></section>
          <div className="submission-consent"><label><input type="checkbox" checked={consent} required disabled={locked} onChange={(event) => setConsent(event.target.checked)} /><span>등록 정보가 정확하며, 이미지와 콘텐츠를 게시할 권한이 있음을 확인했어요.</span></label><p>승인 후 기업명과 소개가 ‘{submissionBoardLabels[form.board]}’에 공개돼요. 사업자등록번호와 담당자 이름·이메일·연락처는 공개되지 않아요.</p></div>
          <div className="submission-save-bar"><div><strong>{uploading ? "이미지를 전송하고 있어요" : busy ? "신청서를 처리하고 있어요" : dirty ? "저장하지 않은 변경사항이 있어요" : lastSavedAt ? "마지막 저장" : "작성 중인 내용은 임시 저장해 주세요"}</strong>{lastSavedAt && <span>{new Date(lastSavedAt).toLocaleString("ko-KR")}</span>}</div><div className="submission-save-actions"><button type="button" className="button button-outline" disabled={locked} onClick={() => void save(false)}>임시 저장</button><button type="submit" className="button button-green" disabled={locked}>{submission?.status === "REJECTED" ? "수정 후 다시 신청" : "게재 신청하기"} <span aria-hidden="true">↗</span></button></div></div>
        </form> : <div className="submission-readonly"><div className="submission-section"><span className="submission-kicker">SUBMITTED PROGRAM</span><div className="submission-readonly-heading">{thumbnailUrl && <img src={thumbnailUrl} alt={`${form.name} 대표 이미지`} />}<div><h2>{form.name}</h2><p>{form.tagline}</p></div></div><p className="submission-readonly-description">{form.description}</p><dl className="submission-fact-list"><div><dt>게시판</dt><dd>{submissionBoardLabels[form.board]}{isHelp && ` · ${helpTypeLabels[form.helpType]}`}</dd></div>{isHelp && <><div><dt>활동 지역</dt><dd>{form.location || "별도 문의"}</dd></div><div><dt>모집 기한</dt><dd>{form.deadline || "상시 모집"}</dd></div></>}<div><dt>기업명</dt><dd>{form.companyName}</dd></div><div><dt>담당자</dt><dd>{form.contactName} · {form.contactEmail}</dd></div><div><dt>{isHelp ? "보상 조건" : "수익 기준"}</dt><dd>{form.commission}</dd></div><div><dt>{isHelp ? "지급 조건" : "정산 기준"}</dt><dd>{form.settlement}</dd></div><div><dt>참여 채널</dt><dd>{form.channels.map((channel) => channelLabels[channel]).join(", ")}</dd></div></dl></div><div className="submission-section"><h3 className="submission-section-title">신청한 상세페이지</h3><DetailContent content={form.content} /></div></div>}
        {credentials && <div className="submission-new"><button type="button" disabled={busy || uploading} onClick={newApplication}>새 게재 신청 작성하기 ↗</button></div>}
      </div>
      <aside className="submission-aside"><div className="submission-aside-card"><h2>게재 절차</h2><ol className="submission-process"><li><span>1</span><div><strong>신청서 작성</strong></div></li><li><span>2</span><div><strong>운영자 검토</strong></div></li><li><span>3</span><div><strong>승인 후 공개</strong></div></li></ol></div><div className="submission-checklist"><h3>신청 준비 <span>{completed.filter(Boolean).length} / 4</span></h3>{["기업 · 담당자 정보", isHelp ? "홍보 · 모집 정보" : "프로그램 기본 정보", "대표 이미지", "상세페이지"].map((label, index) => <div key={label} className={completed[index] ? "completed" : ""}><span>{completed[index] ? "✓" : "○"}</span>{label}</div>)}</div></aside>
    </div>
  </div>;
}

function Required() { return <abbr title="필수 입력" className="submission-required">*</abbr>; }

function Field({ label, name, value, onChange, required, maxLength, placeholder, type = "text", autoComplete, wide }: {
  label: string; name: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength?: number;
  placeholder?: string; type?: string; autoComplete?: string; wide?: boolean;
}) {
  return <label className={`submission-field${wide ? " full-width" : ""}`} htmlFor={name}><span>{label} {required && <Required />}</span><input id={name} name={name} type={type} value={value} required={required} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} /></label>;
}
