"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/submissions";
import { courseCategories, courseLevels, won, type AdminCourse, type AdminLesson, type AdminModule, type CourseInput, type CourseOrder, type CourseStatus } from "@/lib/courses";
import { Icon } from "./icons";

const statusLabels: Record<CourseStatus, string> = { DRAFT: "작성 중", COMING_SOON: "오픈 예정", PUBLISHED: "판매 중", ARCHIVED: "판매 종료" };
const orderStatusLabels: Record<CourseOrder["status"], string> = { PENDING: "결제 대기", PAID: "결제 완료", CANCELED: "취소" };
const newCourse = (): CourseInput => ({ slug: "", title: "", subtitle: "", description: "", category: "AFFILIATE", level: "BEGINNER", status: "DRAFT", isDemo: false, instructorName: "", instructorBio: "", refundPolicy: "", supportEmail: "", thumbnailUrl: "", price: 0, accessDays: 180, weeklyHours: 3, startupCost: 0, outcomes: [""], requirements: [""], relatedProgramSlug: null, curriculum: [] });
const newLesson = (): AdminLesson => ({ id: crypto.randomUUID(), title: "", durationMinutes: 10, preview: false, body: "", videoUrl: "" });
const newModule = (): AdminModule => ({ id: crypto.randomUUID(), title: "", lessons: [newLesson()] });
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요."; }
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function editableCourse(course: AdminCourse): CourseInput {
  const { id, createdAt, updatedAt, ...input } = course;
  void id; void createdAt; void updatedAt;
  return structuredClone(input);
}

type AdminProps = { onSessionExpired: () => void; onDirtyChange?: (dirty: boolean) => void };

export function AdminCourses({ onSessionExpired, onDirtyChange }: AdminProps) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CourseStatus | "ALL">("ALL");
  const [editor, setEditor] = useState<CourseInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = editor !== null && JSON.stringify(editor) !== baseline;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<{ items: AdminCourse[]; total: number }>("/api/admin/courses", { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setCourses(response.items);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, onSessionExpired]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  const filtered = useMemo(() => courses.filter(course => (status === "ALL" || course.status === status) && `${course.title} ${course.instructorName} ${course.slug}`.toLowerCase().includes(query.trim().toLowerCase())), [courses, status, query]);

  function openEditor(course?: AdminCourse) {
    const input = course ? editableCourse(course) : newCourse();
    setEditor(input); setEditingId(course?.id ?? null); setBaseline(JSON.stringify(input)); setFormError(""); setFeedback("");
    window.requestAnimationFrame(() => document.getElementById("course-editor-title")?.focus());
  }
  function closeEditor() {
    if (saving || (dirty && !window.confirm("저장하지 않은 강의 정보가 있습니다. 변경 내용을 닫을까요?"))) return;
    setEditor(null); setEditingId(null); setFormError("");
  }
  function setField<K extends keyof CourseInput>(key: K, value: CourseInput[K]) { setEditor(current => current ? { ...current, [key]: value } : current); }
  function setModule(moduleId: string, change: Partial<AdminModule>) { setEditor(current => current ? { ...current, curriculum: current.curriculum.map(module => module.id === moduleId ? { ...module, ...change } : module) } : current); }
  function setLesson(moduleId: string, lessonId: string, change: Partial<AdminLesson>) {
    setEditor(current => current ? { ...current, curriculum: current.curriculum.map(module => module.id === moduleId ? { ...module, lessons: module.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, ...change } : lesson) } : module) } : current);
  }
  function moveModule(index: number, direction: -1 | 1) {
    if (!editor) return;
    const reordered = [...editor.curriculum];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setField("curriculum", reordered);
  }
  function moveLesson(module: AdminModule, index: number, direction: -1 | 1) {
    const reordered = [...module.lessons];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setModule(module.id, { lessons: reordered });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const input: CourseInput = { ...editor, slug: editor.slug.trim(), title: editor.title.trim(), subtitle: editor.subtitle.trim(), description: editor.description.trim(), instructorName: editor.instructorName.trim(), instructorBio: editor.instructorBio.trim(), refundPolicy: editor.refundPolicy.trim(), supportEmail: editor.supportEmail.trim(), thumbnailUrl: editor.thumbnailUrl.trim(), outcomes: editor.outcomes.map(value => value.trim()).filter(Boolean), requirements: editor.requirements.map(value => value.trim()).filter(Boolean), relatedProgramSlug: editor.relatedProgramSlug?.trim() || null, curriculum: editor.curriculum.map(module => ({ ...module, title: module.title.trim(), lessons: module.lessons.map(lesson => ({ ...lesson, title: lesson.title.trim(), body: lesson.body.trim(), videoUrl: lesson.videoUrl.trim() })) })) };
    if (!input.title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) { setFormError("강의명과 주소를 확인해 주세요. 주소에는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."); return; }
    if (input.curriculum.some(module => !module.title || module.lessons.some(lesson => !lesson.title))) { setFormError("추가한 모든 챕터와 수업의 제목을 작성해 주세요."); return; }
    if (input.outcomes.length > 20 || input.requirements.length > 20 || [...input.outcomes, ...input.requirements].some(value => value.length > 300)) { setFormError("결과물과 준비물은 각각 20개까지, 한 항목은 300자 이내로 작성해 주세요."); return; }
    if (input.curriculum.length > 30 || input.curriculum.some(module => module.lessons.length > 50) || input.curriculum.reduce((sum, module) => sum + module.lessons.length, 0) > 200) { setFormError("챕터는 30개, 챕터별 수업은 50개, 전체 수업은 200개까지 등록할 수 있습니다."); return; }
    if (input.status === "PUBLISHED") {
      if (input.isDemo) { setFormError("예시 강의는 판매할 수 없습니다. 실제 수업과 판매 정보를 준비한 뒤 예시 강의 설정을 해제해 주세요."); return; }
      if (input.price < 1000) { setFormError("판매할 강의의 개별 구매 가격을 1,000원 이상으로 입력해 주세요."); return; }
      if (input.description.length < 20 || input.instructorName.length < 2 || input.instructorBio.length < 10) { setFormError("판매 시작 전 강의 소개 20자 이상, 강사 이름 2자 이상, 강사 소개 10자 이상을 작성해 주세요."); return; }
      if (input.refundPolicy.length < 20 || !input.supportEmail) { setFormError("판매 시작 전 환불·취소 안내를 20자 이상 작성하고 수강 문의 이메일을 등록해 주세요."); return; }
      if (!input.outcomes.length || !input.requirements.length) { setFormError("판매 시작 전 결과물과 준비물을 각각 한 항목 이상 작성해 주세요."); return; }
      if (!input.curriculum.length || input.curriculum.some(module => !module.lessons.length || module.lessons.some(lesson => lesson.body.length < 20 && !lesson.videoUrl))) { setFormError("판매할 강의에는 챕터와 수업이 필요합니다. 모든 수업에 20자 이상의 본문 또는 영상 주소를 등록해 주세요."); return; }
    }
    setSaving(true); setFormError("");
    try {
      await api<AdminCourse>(editingId ? `/api/admin/courses/${encodeURIComponent(editingId)}` : "/api/admin/courses", { method: editingId ? "PUT" : "POST", body: JSON.stringify(input) });
      setFeedback(`‘${input.title}’ 강의를 저장했습니다. 현재 상태는 ${statusLabels[input.status]}입니다.`);
      setEditor(null); setEditingId(null); setBaseline(""); setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setFormError(errorMessage(cause));
    } finally { setSaving(false); }
  }

  if (editor) return <section className="course-admin-editor" aria-label={editingId ? "강의 수정" : "새 강의 등록"}>
    <div className="course-admin-heading"><div><span className="section-kicker">COURSE EDITOR</span><h2 id="course-editor-title" tabIndex={-1}>{editingId ? "강의 수정" : "새 강의 등록"}</h2><p>배우는 데서 끝나지 않고, 첫 부업을 시작할 수 있도록 구성해 주세요.</p></div><button type="button" className="button button-outline" onClick={closeEditor} disabled={saving}>목록으로</button></div>
    <form onSubmit={save}>
      <fieldset className="course-admin-form" disabled={saving}>
        <section className="course-admin-form-section"><div className="course-admin-section-title"><span>01</span><div><h3>강의 소개</h3><p>목록과 상세페이지에 보여줄 정보를 입력하세요.</p></div></div>
          <div className="course-admin-fields">
            <label className="course-admin-wide">강의명 <span aria-hidden="true">*</span><input required minLength={3} maxLength={160} value={editor.title} onChange={event => setField("title", event.target.value)} placeholder="예: 첫 제휴 링크로 시작하는 블로그 부업" /></label>
            <label className="course-admin-wide">한 줄 소개<input maxLength={240} value={editor.subtitle} onChange={event => setField("subtitle", event.target.value)} placeholder="누구를 위한 강의인지, 무엇을 완성하는지 알려 주세요." /></label>
            <label>강의 주소 <span aria-hidden="true">*</span><input required minLength={3} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} value={editor.slug} onChange={event => setField("slug", event.target.value)} placeholder="my-first-affiliate" /><small>/courses/ 뒤에 표시됩니다. 저장 후에는 가급적 유지해 주세요.</small></label>
            <label>분야<select value={editor.category} onChange={event => setField("category", event.target.value as CourseInput["category"])}>{Object.entries(courseCategories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>난이도<select value={editor.level} onChange={event => setField("level", event.target.value as CourseInput["level"])}>{Object.entries(courseLevels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>연결할 부업 주소<input maxLength={100} value={editor.relatedProgramSlug || ""} onChange={event => setField("relatedProgramSlug", event.target.value || null)} placeholder="예: coupang-partners" /><small>선택 사항 · 수강 후 시작할 부업의 주소를 입력하세요.</small></label>
            <label className="course-admin-wide">강의 상세 소개<textarea rows={6} maxLength={12000} value={editor.description} onChange={event => setField("description", event.target.value)} placeholder="강의의 목표, 진행 방식, 대상 수강생을 자세히 소개해 주세요." /></label>
            <label className="course-admin-wide">대표 이미지 주소<input type="url" maxLength={2000} value={editor.thumbnailUrl} onChange={event => setField("thumbnailUrl", event.target.value)} placeholder="https://…" /><small>공개된 이미지 주소를 사용하세요. 비워두면 분야별 기본 커버가 표시됩니다.</small></label>
          </div>
        </section>
        <section className="course-admin-form-section"><div className="course-admin-section-title"><span>02</span><div><h3>수강 조건과 결과물</h3><p>수강생이 필요한 시간과 비용을 미리 판단할 수 있게 알려 주세요.</p></div></div>
          <div className="course-admin-fields">
            <label>개별 구매 가격 (원)<input type="number" required min={0} max={10000000} step={1} value={editor.price} onChange={event => setField("price", Number(event.target.value))} /></label>
            <label>수강 기간 (일)<input type="number" required min={1} max={3650} step={1} value={editor.accessDays} onChange={event => setField("accessDays", Number(event.target.value))} /></label>
            <label>주당 권장 학습 시간<input type="number" required min={1} max={168} step={1} value={editor.weeklyHours} onChange={event => setField("weeklyHours", Number(event.target.value))} /></label>
            <label>예상 부업 시작 비용 (원)<input type="number" required min={0} max={100000000} step={1} value={editor.startupCost} onChange={event => setField("startupCost", Number(event.target.value))} /><small>수강료 외에 필요한 비용입니다. 추가 비용이 없으면 0원.</small></label>
            <label>수강 후 완성할 결과물<textarea rows={5} maxLength={6000} value={editor.outcomes.join("\n")} onChange={event => setField("outcomes", event.target.value.split("\n"))} placeholder={"항목마다 줄을 바꿔 주세요.\n첫 제휴 링크가 들어간 블로그 글 1편\n나만의 콘텐츠 발행 계획표"} /></label>
            <label>준비물과 사전 조건<textarea rows={5} maxLength={6000} value={editor.requirements.join("\n")} onChange={event => setField("requirements", event.target.value.split("\n"))} placeholder={"항목마다 줄을 바꿔 주세요.\n인터넷이 연결된 노트북\n블로그 계정"} /></label>
            <label className="course-admin-wide">환불·취소 안내<textarea rows={4} maxLength={5000} value={editor.refundPolicy} onChange={event => setField("refundPolicy", event.target.value)} placeholder="구매 전 확인할 수 있도록 환불 조건, 신청 방법, 처리 절차를 구체적으로 적어 주세요." /></label><label className="course-admin-wide">수강 문의 이메일<input type="email" maxLength={254} value={editor.supportEmail} onChange={event => setField("supportEmail", event.target.value)} placeholder="support@example.com" /><small>수강생에게 공개되는 문의 주소입니다. 판매 시작 전에 반드시 등록해 주세요.</small></label>
            <label>강사 이름<input maxLength={100} value={editor.instructorName} onChange={event => setField("instructorName", event.target.value)} placeholder="강사 이름 또는 활동명" /></label>
            <label>강사 소개<textarea rows={3} maxLength={3000} value={editor.instructorBio} onChange={event => setField("instructorBio", event.target.value)} placeholder="강의와 관련된 경험과 전문 분야를 소개해 주세요." /></label>
          </div>
        </section>
        <section className="course-admin-form-section"><div className="course-admin-section-title"><span>03</span><div><h3>커리큘럼</h3><p>챕터별로 수업을 추가하세요. 미리보기로 지정한 수업 내용은 누구나 볼 수 있습니다.</p></div></div>
          {editor.curriculum.length === 0 && <div className="course-admin-curriculum-empty"><Icon name="book" size={28} /><p>첫 번째 챕터를 추가해 강의의 흐름을 만들어 보세요.</p></div>}
          <div className="course-admin-modules">{editor.curriculum.map((module, moduleIndex) => <section className="course-admin-module" key={module.id} aria-label={`챕터 ${moduleIndex + 1}`}>
            <div className="course-admin-module-top"><strong>챕터 {String(moduleIndex + 1).padStart(2, "0")}</strong><div className="course-admin-item-actions"><button type="button" disabled={moduleIndex === 0} onClick={() => moveModule(moduleIndex, -1)} aria-label={`챕터 ${moduleIndex + 1} 위로 이동`}>위로</button><button type="button" disabled={moduleIndex === editor.curriculum.length - 1} onClick={() => moveModule(moduleIndex, 1)} aria-label={`챕터 ${moduleIndex + 1} 아래로 이동`}>아래로</button><button type="button" className="course-admin-remove" onClick={() => { if (window.confirm("이 챕터와 안에 있는 수업을 삭제할까요? 저장하면 반영됩니다.")) setField("curriculum", editor.curriculum.filter(item => item.id !== module.id)); }}>챕터 삭제</button></div></div>
            <label>챕터 제목<input required maxLength={160} value={module.title} onChange={event => setModule(module.id, { title: event.target.value })} placeholder="예: 첫 콘텐츠를 발행하기 전 준비" /></label>
            <div className="course-admin-lessons">{module.lessons.map((lesson, lessonIndex) => <details className="course-admin-lesson" open key={lesson.id}>
              <summary><span>수업 {moduleIndex + 1}-{lessonIndex + 1}</span><strong>{lesson.title || "새 수업"}</strong>{lesson.preview && <em>미리보기</em>}<Icon name="chevron" size={16} /></summary>
              <div className="course-admin-lesson-body"><div className="course-admin-fields"><label>수업 제목<input required maxLength={160} value={lesson.title} onChange={event => setLesson(module.id, lesson.id, { title: event.target.value })} placeholder="수업 제목을 입력하세요." /></label><label>수업 시간 (분)<input type="number" required min={1} max={600} step={1} value={lesson.durationMinutes} onChange={event => setLesson(module.id, lesson.id, { durationMinutes: Number(event.target.value) })} /></label><label className="course-admin-wide">영상 주소<input type="url" maxLength={2000} value={lesson.videoUrl} onChange={event => setLesson(module.id, lesson.id, { videoUrl: event.target.value })} placeholder="https://…/lesson.mp4" /><small>선택 사항 · 재생 가능한 HTTPS 영상 파일 주소를 입력하세요.</small></label><label className="course-admin-wide">수업 본문<textarea rows={5} maxLength={50000} value={lesson.body} onChange={event => setLesson(module.id, lesson.id, { body: event.target.value })} placeholder="수업 내용, 실습 과제, 체크리스트를 작성해 주세요. 일반 텍스트로 표시됩니다." /></label></div><div className="course-admin-lesson-actions"><label className="course-admin-check"><input type="checkbox" checked={lesson.preview} onChange={event => setLesson(module.id, lesson.id, { preview: event.target.checked })} />무료 미리보기로 공개</label><div className="course-admin-item-actions"><button type="button" disabled={lessonIndex === 0} onClick={() => moveLesson(module, lessonIndex, -1)} aria-label={`수업 ${moduleIndex + 1}-${lessonIndex + 1} 위로 이동`}>위로</button><button type="button" disabled={lessonIndex === module.lessons.length - 1} onClick={() => moveLesson(module, lessonIndex, 1)} aria-label={`수업 ${moduleIndex + 1}-${lessonIndex + 1} 아래로 이동`}>아래로</button><button type="button" className="course-admin-remove" onClick={() => { if (window.confirm("이 수업을 삭제할까요? 저장하면 반영됩니다.")) setModule(module.id, { lessons: module.lessons.filter(item => item.id !== lesson.id) }); }}>수업 삭제</button></div></div></div>
            </details>)}</div>
            <button type="button" className="button button-outline course-admin-add-lesson" onClick={() => setModule(module.id, { lessons: [...module.lessons, newLesson()] })}>+ 수업 추가</button>
          </section>)}</div>
          <button type="button" className="button button-outline course-admin-add-module" onClick={() => setField("curriculum", [...editor.curriculum, newModule()])}>+ 챕터 추가</button>
        </section>
        <section className="course-admin-form-section"><div className="course-admin-section-title"><span>04</span><div><h3>공개 설정</h3><p>강의와 수강 조건을 모두 확인한 뒤 판매 상태로 변경해 주세요.</p></div></div><div className="course-admin-fields"><label>강의 상태<select value={editor.status} onChange={event => setField("status", event.target.value as CourseStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>작성 중은 비공개, 오픈 예정은 소개 공개, 판매 중은 구매 가능 상태입니다.</small></label><div className="course-admin-demo-control"><label className="course-admin-check"><input type="checkbox" checked={editor.isDemo} onChange={event => setField("isDemo", event.target.checked)} />예시 강의</label><p>예시 강의는 구매할 수 없으며 판매 중으로 전환할 수 없습니다. 실제 강의로 운영할 때 해제해 주세요.</p></div></div></section>
      </fieldset>
      {formError && <p className="admin-error course-admin-form-error" role="alert">{formError}</p>}
      <div className="course-admin-save-bar"><p>{dirty ? "저장하지 않은 변경 사항이 있어요." : "강의 정보를 입력하고 저장해 주세요."}</p><div><button type="button" className="button button-outline" onClick={closeEditor} disabled={saving}>취소</button><button type="submit" className="button button-green" disabled={saving}>{saving ? "저장 중…" : "강의 저장"}<Icon name="check" size={17} /></button></div></div>
    </form>
  </section>;

  return <section className="course-admin" aria-label="강의 관리">
    <div className="course-admin-heading"><div><h2>부업 강의 관리</h2><p>강의별 개별 구매 · 실습 결과물과 시작 조건이 분명한 강의를 만드세요.</p></div><button type="button" className="button button-green" onClick={() => openEditor()}>+ 새 강의</button></div>
    <div className="course-admin-summary"><div><span>전체 강의</span><strong>{courses.length}</strong></div><div><span>판매 중</span><strong>{courses.filter(course => course.status === "PUBLISHED" && !course.isDemo).length}</strong></div><div><span>오픈 예정</span><strong>{courses.filter(course => course.status === "COMING_SOON").length}</strong></div><div><span>작성 중</span><strong>{courses.filter(course => course.status === "DRAFT").length}</strong></div></div>
    <div className="course-admin-toolbar"><label className="course-admin-search"><Icon name="search" size={18} /><input aria-label="강의 검색" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="강의명, 강사명, 주소 검색" /></label><select aria-label="강의 상태 필터" value={status} onChange={event => setStatus(event.target.value as CourseStatus | "ALL")}><option value="ALL">모든 상태</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="button button-outline" onClick={() => setRevision(value => value + 1)} disabled={loading}>새로고침</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    <p className="course-admin-result" role="status">{loading ? "강의를 불러오고 있습니다…" : `총 ${filtered.length}개의 강의`}</p>
    {!loading && !error && filtered.length === 0 && <div className="admin-empty"><Icon name="book" size={30} /><h3>{query || status !== "ALL" ? "조건에 맞는 강의가 없어요" : "첫 부업 강의를 등록해 보세요"}</h3><p>{query || status !== "ALL" ? "검색어나 상태를 바꿔 보세요." : "소개, 커리큘럼, 개별 구매 가격을 한곳에서 관리할 수 있어요."}</p></div>}
    <div className="course-admin-list" aria-busy={loading}>{filtered.map(course => <article className="course-admin-card" key={course.id}><div className="course-admin-card-meta"><span className={`course-admin-badge course-admin-status-${course.status.toLowerCase()}`}>{statusLabels[course.status]}</span>{course.isDemo && <span className="course-admin-badge">예시 강의</span>}<span>{courseCategories[course.category]}</span></div><h3>{course.title}</h3><p>{course.subtitle || "한 줄 소개를 작성해 주세요."}</p><dl><div><dt>강사</dt><dd>{course.instructorName || "미등록"}</dd></div><div><dt>판매가</dt><dd>{won(course.price)}</dd></div><div><dt>수업</dt><dd>{course.curriculum.reduce((sum, module) => sum + module.lessons.length, 0)}개 · {course.accessDays}일 수강</dd></div></dl><div className="course-admin-card-bottom"><time dateTime={course.updatedAt}>수정 {date(course.updatedAt)}</time><div>{(course.status === "COMING_SOON" || course.status === "PUBLISHED") && <Link className="button button-outline" href={`/courses/${encodeURIComponent(course.slug)}`} target="_blank" rel="noopener noreferrer">보기 ↗</Link>}<button className="button button-green" type="button" onClick={() => openEditor(course)}>수정</button></div></div></article>)}</div>
  </section>;
}

export function AdminCourseOrders({ onSessionExpired }: Pick<AdminProps, "onSessionExpired">) {
  const [orders, setOrders] = useState<CourseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<CourseOrder["status"] | "ALL">("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [canceling, setCanceling] = useState(false);
  const size = 20;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status !== "ALL") params.set("status", status);
    api<{ items: CourseOrder[]; total: number }>(`/api/admin/course-orders?${params}`, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) { setOrders(response.items); setTotal(response.total); }
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, status, onSessionExpired]);

  async function cancelOrder(event: FormEvent<HTMLFormElement>, order: CourseOrder) {
    event.preventDefault();
    if (canceling) return;
    if (cancelReason.trim().length < 3) { setCancelError("환불 사유를 3자 이상 입력해 주세요."); return; }
    setCanceling(true); setCancelError(""); setFeedback("");
    try {
      await api<CourseOrder>(`/api/admin/course-orders/${encodeURIComponent(order.id)}/cancel`, { method: "POST", body: JSON.stringify({ reason: cancelReason.trim() }) });
      setFeedback(`‘${order.courseTitle}’ 주문의 ${won(order.amount)} 전액 환불을 완료했습니다. 해당 주문의 수강 권한이 종료되었습니다.`);
      setCancelId(null); setCancelReason("");
      if (status === "PAID" && orders.length === 1 && page > 0) setPage(value => value - 1);
      else setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
      setCancelError(errorMessage(cause));
    } finally { setCanceling(false); }
  }

  const paid = orders.filter(order => order.status === "PAID");
  return <section className="course-admin" aria-label="강의 주문 관리">
    <div className="course-admin-heading"><div><h2>강의 주문</h2><p>개별 강의의 결제 상태와 수강 기간을 확인하세요.</p></div><button type="button" className="button button-outline" onClick={() => setRevision(value => value + 1)} disabled={loading || canceling}>새로고침</button></div>
    <div className="course-admin-summary course-admin-order-summary"><div><span>{status === "ALL" ? "전체 주문" : `${orderStatusLabels[status]} 주문`}</span><strong>{total}</strong></div><div><span>현재 페이지 결제 완료</span><strong>{paid.length}</strong></div><div><span>현재 페이지 결제 완료 금액</span><strong>{won(paid.reduce((sum, order) => sum + order.amount, 0))}</strong></div></div>
    <div className="course-admin-toolbar"><label className="course-admin-order-filter">결제 상태<select aria-label="주문 상태 필터" disabled={canceling} value={status} onChange={event => { setStatus(event.target.value as CourseOrder["status"] | "ALL"); setPage(0); setCancelId(null); setCancelError(""); }}><option value="ALL">모든 결제 상태</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    <p className="course-admin-result" role="status">{loading ? "주문을 불러오고 있습니다…" : `총 ${total}건 · 최신순`}</p>
    {!loading && !error && orders.length === 0 && <div className="admin-empty"><Icon name="book" size={30} /><h3>{status !== "ALL" ? "해당 상태의 주문이 없어요" : "아직 강의 주문이 없어요"}</h3><p>강의별 구매 내역과 결제 결과가 이곳에 표시됩니다.</p></div>}
    <div className="course-admin-orders" aria-busy={loading}>{orders.map(order => <article key={order.id} className="course-admin-order">
      <div className="course-admin-order-heading"><div><span className={`course-admin-badge course-admin-order-${order.status.toLowerCase()}`}>{orderStatusLabels[order.status]}</span><h3>{order.courseTitle}</h3><code>{order.id}</code></div><strong>{won(order.amount)}</strong></div>
      <dl><div><dt>구매자</dt><dd>{order.buyerName}</dd></div><div><dt>이메일</dt><dd>{order.buyerEmail}</dd></div><div><dt>주문 일시</dt><dd>{date(order.createdAt)}</dd></div><div><dt>결제 일시</dt><dd>{date(order.paidAt)}</dd></div><div><dt>수강 종료</dt><dd>{date(order.expiresAt)}</dd></div></dl>
      {order.status === "PAID" && (cancelId === order.id ? <form className="course-admin-refund" onSubmit={event => void cancelOrder(event, order)}><h4>이 주문을 전액 환불할까요?</h4><p>{won(order.amount)} 결제가 실제로 취소되며 수강 권한이 종료됩니다. 강의의 환불 정책과 구매자 요청을 확인한 뒤 진행해 주세요.</p><label htmlFor={`refund-reason-${order.id}`}>환불 사유</label><textarea id={`refund-reason-${order.id}`} required minLength={3} maxLength={200} rows={3} value={cancelReason} disabled={canceling} onChange={event => setCancelReason(event.target.value)} placeholder="구매자 요청 등 환불 사유를 입력하세요." />{cancelError && <p className="admin-error" role="alert">{cancelError}</p>}<div><button type="button" className="button button-outline" disabled={canceling} onClick={() => { setCancelId(null); setCancelError(""); }}>돌아가기</button><button type="submit" className="button course-admin-refund-confirm" disabled={canceling}>{canceling ? "환불 처리 중…" : "전액 환불 확정"}</button></div></form> : <div className="course-admin-order-actions"><button type="button" className="button button-outline" disabled={loading || canceling} onClick={() => { setCancelId(order.id); setCancelReason(""); setCancelError(""); setFeedback(""); }}>전액 환불</button></div>)}
    </article>)}</div>
    <div className="admin-pagination"><button type="button" disabled={page === 0 || loading || canceling} onClick={() => { setPage(value => value - 1); setCancelId(null); }}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(total / size))}</span><button type="button" disabled={(page + 1) * size >= total || loading || canceling} onClick={() => { setPage(value => value + 1); setCancelId(null); }}>다음</button></div>
  </section>;
}
