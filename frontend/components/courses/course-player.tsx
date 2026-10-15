"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { CourseOrderRestore, courseDate, courseOrderExpired } from "./classroom";
import { getCourseOrderCredentials, orderHeaders } from "@/lib/course-access";
import type { Course, CourseOrder, LessonContent, OrderCredentials } from "@/lib/courses";
import { api } from "@/lib/submissions";

function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "강의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."; }

export function CoursePlayer({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<OrderCredentials | null>(null);
  const [order, setOrder] = useState<CourseOrder | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [lessonId, setLessonId] = useState("");
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState("");
  const [lessonRevision, setLessonRevision] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [, setClock] = useState(0);
  const activeOrderId = useRef(orderId);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    activeOrderId.current = orderId;
    const saved = getCourseOrderCredentials(orderId);
    setCredentials(saved); setOrder(null); setCourse(null); setLesson(null); setLessonId("");
    setError(""); setLoading(true); setProgressError(""); setProgressMessage(""); setSaving(false);
    if (!saved) { setLoading(false); return () => { active = false; controller.abort(); }; }
    async function load() {
      try {
        const headers = orderHeaders(saved!);
        const currentOrder = await api<CourseOrder>(`/api/course-orders/${encodeURIComponent(orderId)}`, { headers, signal: controller.signal });
        if (!active) return;
        setOrder(currentOrder);
        if (currentOrder.status !== "PAID" || courseOrderExpired(currentOrder)) return;
        const metadata = await api<Course>(`/api/course-orders/${encodeURIComponent(orderId)}/course`, { headers, signal: controller.signal });
        if (!active) return;
        const lessons = metadata.curriculum.flatMap((module) => module.lessons);
        setCourse(metadata);
        setLessonId((lessons.find((item) => !currentOrder.completedLessonIds.includes(item.id)) ?? lessons[0])?.id ?? "");
      } catch (reason) { if (active) setError(errorMessage(reason)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [orderId, revision]);

  const canWatch = Boolean(order && order.status === "PAID" && !courseOrderExpired(order));
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLesson(null); setLessonError(""); setVideoError(false); setProgressError(""); setProgressMessage("");
    if (!credentials || !canWatch || !lessonId) { setLessonLoading(false); return () => { active = false; controller.abort(); }; }
    setLessonLoading(true);
    async function loadLesson() {
      try {
        const current = await api<LessonContent>(`/api/course-orders/${encodeURIComponent(orderId)}/lessons/${encodeURIComponent(lessonId)}`, { headers: orderHeaders(credentials!), signal: controller.signal });
        if (active) setLesson(current);
      } catch (reason) { if (active) setLessonError(errorMessage(reason)); }
      finally { if (active) setLessonLoading(false); }
    }
    void loadLesson();
    return () => { active = false; controller.abort(); };
  }, [credentials, canWatch, lessonId, orderId, lessonRevision]);

  async function toggleComplete() {
    if (!credentials || !order || !lesson || saving) return;
    const completed = !order.completedLessonIds.includes(lesson.id);
    setSaving(true); setProgressError(""); setProgressMessage("");
    try {
      const updated = await api<CourseOrder>(`/api/course-orders/${encodeURIComponent(orderId)}/lessons/${encodeURIComponent(lesson.id)}/progress`, {
        method: "POST", headers: orderHeaders(credentials), body: JSON.stringify({ completed }),
      });
      if (activeOrderId.current === orderId) { setOrder(updated); setProgressMessage(completed ? "수강 완료 표시를 저장했어요." : "완료 표시를 해제했어요."); }
    } catch (reason) { if (activeOrderId.current === orderId) setProgressError(errorMessage(reason)); }
    finally { if (activeOrderId.current === orderId) setSaving(false); }
  }

  function restore(restored: CourseOrder) {
    if (restored.id === orderId) setRevision((value) => value + 1);
    else router.push(`/classroom/${encodeURIComponent(restored.id)}`);
  }

  const back = <Link href="/classroom" className="back-link"><Icon name="arrow" size={15} />내 강의실로 돌아가기</Link>;
  if (loading) return <div className="course-player-page container">{back}<div className="course-loading" role="status">수강 정보를 확인하고 있어요…</div></div>;
  if (!credentials) return <div className="course-player-page container">{back}<div className="course-empty"><Icon name="book" size={30} /><h1>강의를 불러와 주세요</h1><p>이 브라우저에 해당 주문이 연결되어 있지 않아요.<br />주문 번호와 복구 코드로 강의를 불러올 수 있어요.</p></div><CourseOrderRestore key={orderId} initialOrderId={orderId} onRestored={restore} open /></div>;
  if (error) return <div className="course-player-page container">{back}<div className="course-empty"><h1>강의를 확인하지 못했어요</h1><p className="course-error" role="alert">{error}</p><button className="button button-outline" onClick={() => setRevision((value) => value + 1)}>다시 불러오기</button></div><CourseOrderRestore key={orderId} initialOrderId={orderId} onRestored={restore} /></div>;
  if (!order || !canWatch) {
    const heading = order?.status === "PENDING" ? "결제 완료 후 수강할 수 있어요" : order?.status === "CANCELED" ? "취소된 주문이에요" : "수강 기간이 종료되었어요";
    return <div className="course-player-page container">{back}<div className="course-empty"><Icon name="info" size={30} /><h1>{heading}</h1><p>{order?.courseTitle}{order?.status === "PAID" && <><br />수강 기한 {courseDate(order.expiresAt)}</>}</p><Link className="button button-outline" href={order?.status === "PENDING" ? `/courses/${encodeURIComponent(order.courseSlug)}/checkout?orderId=${encodeURIComponent(order.id)}` : "/courses"}>{order?.status === "PENDING" ? "결제 이어하기" : "다른 부업 강의 둘러보기"}</Link></div></div>;
  }
  if (!course) return <div className="course-player-page container">{back}<p className="course-error" role="alert">강의 정보를 불러오지 못했어요.</p><button className="button button-outline" onClick={() => setRevision((value) => value + 1)}>다시 불러오기</button></div>;

  const lessons = course.curriculum.flatMap((module) => module.lessons);
  const completed = lessons.filter((item) => order.completedLessonIds.includes(item.id)).length;
  const currentComplete = order.completedLessonIds.includes(lessonId);
  const selected = lessons.find((item) => item.id === lessonId);
  const index = lessons.findIndex((item) => item.id === lessonId);
  const next = lessons[index + 1];

  return <div className="course-player-page container">{back}<div className="course-player-layout">
    <article className="course-player-content" aria-busy={lessonLoading}>
      <span className="section-kicker">{course.title}</span><h1>{selected?.title || "학습할 수업을 선택해 주세요"}</h1>
      {lessonLoading ? <div className="course-loading" role="status">수업을 불러오고 있어요…</div> : lessonError ? <div><p className="course-error" role="alert">{lessonError}</p><button className="button button-outline" style={{ marginTop: 16 }} onClick={() => setLessonRevision((value) => value + 1)}>수업 다시 불러오기</button></div> : lesson && lesson.id === lessonId ? <>
        {lesson.videoUrl && <><video key={lesson.id} controls playsInline preload="metadata" onError={() => setVideoError(true)} aria-label={lesson.title}><source src={lesson.videoUrl} />동영상 재생을 지원하는 브라우저를 이용해 주세요.</video>{videoError && <div><p className="course-error" role="alert">동영상을 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.</p><button className="button button-outline" style={{ marginTop: 12 }} disabled={saving} onClick={() => setLessonRevision((value) => value + 1)}>동영상 다시 불러오기</button></div>}</>}
        {lesson.body && <div className="course-lesson-body">{lesson.body}</div>}
        <div className="course-player-completion"><button className={`button ${currentComplete ? "button-outline" : "button-green"}`} aria-pressed={currentComplete} onClick={toggleComplete} disabled={saving}><Icon name="check" size={16} />{saving ? "저장 중…" : currentComplete ? "완료 표시 해제" : "수강 완료로 표시"}</button><span>{selected?.durationMinutes}분 · {currentComplete ? "완료한 수업" : "학습한 뒤 완료로 표시해 주세요"}</span></div>
        {progressError && <p className="course-error" role="alert" style={{ marginTop: 16 }}>{progressError}</p>}
        {progressMessage && <p role="status" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>{progressMessage}</p>}
        {next && <button className="button button-outline" style={{ marginTop: 25 }} onClick={() => setLessonId(next.id)} disabled={saving}>다음 수업 <Icon name="arrow" size={15} /></button>}
      </> : lessons.length === 0 ? <p className="course-error">등록된 수업이 없어요. 강의 문의처로 문의해 주세요.</p> : null}
      {course.supportEmail && <p style={{ marginTop: 28, fontSize: 12, color: "var(--muted)", overflowWrap: "anywhere" }}>수강 문의 · <a href={`mailto:${course.supportEmail}`}>{course.supportEmail}</a></p>}
    </article>
    <aside className="course-player-sidebar" aria-label="커리큘럼과 학습 진도">
      <h2>{course.title}</h2><progress value={completed} max={Math.max(lessons.length, 1)} aria-label="학습 진도" /><p>{lessons.length ? Math.round(completed / lessons.length * 100) : 0}% 완료 · {completed}/{lessons.length}개 수업</p><p style={{ marginTop: 9 }}>수강 기한 {courseDate(order.expiresAt)}</p>
      {course.curriculum.map((module, moduleIndex) => <section key={module.id}><h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>{module.lessons.map((item) => <button className={lessonId === item.id ? "active" : ""} key={item.id} onClick={() => setLessonId(item.id)} aria-current={lessonId === item.id ? "step" : undefined} disabled={saving}><Icon name={order.completedLessonIds.includes(item.id) ? "check" : "book"} size={14} /><span>{item.title}<span style={{ display: "block", fontSize: 10, color: "var(--muted)" }}>{item.durationMinutes}분{order.completedLessonIds.includes(item.id) ? " · 완료" : ""}</span></span></button>)}</section>)}
    </aside>
  </div></div>;
}
