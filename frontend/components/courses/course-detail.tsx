"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/submissions";
import { courseCategories, courseLevels, courseDuration, courseLessonCount, won, type Course, type LessonContent } from "@/lib/courses";
import { CourseCover } from "./course-cover";
import { Icon } from "../icons";

export function CourseDetail({ course }: { course: Course }) {
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  useEffect(() => { if ((loading || lesson || error) && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [loading, lesson, error]);
  function closePreview() { request.current++; dialog.current?.close(); setLoading(""); setLesson(null); setError(""); }
  const preview = course.curriculum.flatMap(m => m.lessons).find(l => l.preview);
  async function openPreview(id: string) {
    const current = ++request.current; setLoading(id); setError(""); setLesson(null);
    try { const content = await api<LessonContent>(`/api/courses/${course.slug}/lessons/${id}/preview`); if (request.current === current) setLesson(content); }
    catch (e) { if (request.current === current) setError(e instanceof Error ? e.message : "미리보기를 불러오지 못했어요."); }
    finally { if (request.current === current) setLoading(""); }
  }
  return <div className="container course-detail-page"><Link href="/courses" className="back-link"><Icon name="arrow" size={15} />부업 클래스</Link><div className="course-detail-layout"><article><CourseCover course={course} /><div className="course-detail-heading"><div><span>{courseCategories[course.category]}</span><span>{courseLevels[course.level]}</span>{course.isDemo && <span>기획 예시 · 판매 준비 중</span>}</div><h1>{course.title}</h1><p>{course.subtitle}</p><span className="course-instructor">{course.instructorName} · {courseLessonCount(course)}개 수업 · 총 {courseDuration(course)}분</span></div><nav className="course-detail-tabs" aria-label="강의 상세 메뉴"><a href="#course-about">강의 소개</a><a href="#course-curriculum">커리큘럼</a><a href="#course-instructor">강사 소개</a><a href="#course-policy">구매 전 안내</a></nav>
      <section id="course-about" className="course-detail-section"><h2>강의 소개</h2><p className="course-description">{course.description}</p><ul className="course-outcomes">{course.outcomes.map(item => <li key={item}><Icon name="check" size={18} />{item}</li>)}</ul><div className="course-fit-grid"><div><small>매주 필요한 시간</small><strong>주 {course.weeklyHours}시간</strong><p>학습과 실습에 필요한 예상 시간</p></div><div><small>추가 실습비</small><strong>{won(course.startupCost)}</strong><p>강의료를 제외한 예상 시작 비용</p></div></div><h3>준비물</h3><ul className="course-requirements">{course.requirements.map(item => <li key={item}>{item}</li>)}</ul></section>
      <section id="course-curriculum" className="course-detail-section"><h2>커리큘럼</h2><p>커리큘럼 · {course.curriculum.length}개 챕터 · {courseLessonCount(course)}개 수업</p>{course.curriculum.map((module, index) => <details className="course-module" key={module.id} open><summary><span>{String(index + 1).padStart(2, "0")}</span>{module.title}<small>{module.lessons.length}개 수업</small></summary><ol>{module.lessons.map(item => <li key={item.id}><div><span>{item.title}</span><small>{item.durationMinutes}분</small></div>{item.preview ? <button className="button button-outline" disabled={!!loading} onClick={() => void openPreview(item.id)}>{loading === item.id ? "불러오는 중" : "미리보기"}</button> : <span className="lesson-locked">수강 후 공개</span>}</li>)}</ol></details>)}</section>
      <section id="course-instructor" className="course-detail-section"><h2>{course.instructorName}</h2><p className="course-description">{course.instructorBio}</p></section>
      <section id="course-policy" className="course-detail-section"><h2>구매 안내</h2><dl className="course-policy-list"><div><dt>수강 기간</dt><dd>결제 완료일부터 {course.accessDays}일</dd></div><div><dt>제공 방식</dt><dd>내 강의실에서 영상·텍스트 수업을 학습합니다. 수업별 제공 방식은 커리큘럼을 확인해주세요.</dd></div><div><dt>환불·취소 안내</dt><dd>{course.refundPolicy || "정식 출시 시 안내합니다."}</dd></div>{course.supportEmail && <div><dt>수강 문의</dt><dd><a href={`mailto:${course.supportEmail}`}>{course.supportEmail}</a></dd></div>}</dl><p className="course-disclosure">강의는 학습과 실행을 돕는 콘텐츠입니다. 실제 결과는 개인의 경험, 실습과 시장 상황에 따라 달라지며 수익을 보장하지 않습니다.</p></section>
      {course.relatedProgramSlug && <Link className="course-related" href={`/programs/${encodeURIComponent(course.relatedProgramSlug)}`}><Icon name="link" /><div><strong>관련 부업</strong></div><Icon name="arrow" /></Link>}
    </article><aside className="course-purchase-panel"><h2>수강 정보</h2>{course.status === "PUBLISHED" && !course.isDemo ? <><span className="course-price-label">강의별 개별 구매</span><strong className="course-price">{won(course.price)}</strong></> : <div className="course-opening"><strong>출시 준비 중</strong>{course.isDemo && <p>기획 예시</p>}</div>}<dl><div><dt>난이도</dt><dd>{courseLevels[course.level]}</dd></div><div><dt>수강 기간</dt><dd>{course.accessDays}일</dd></div><div><dt>수업</dt><dd>{courseLessonCount(course)}개 · {courseDuration(course)}분</dd></div><div><dt>예상 실습비</dt><dd>{won(course.startupCost)}</dd></div></dl>{course.status === "PUBLISHED" && !course.isDemo ? <Link href={`/courses/${course.slug}/checkout`} className="button button-green">이 강의 수강하기 <Icon name="arrow" size={17} /></Link> : <button className="button button-green" disabled>출시 준비 중</button>}{preview && <button className="button button-outline" disabled={!!loading} onClick={() => void openPreview(preview.id)}>첫 수업 미리보기 <Icon name="book" size={16} /></button>}<Link href="/classroom" className="course-classroom-link">내 강의실 <Icon name="chevron" size={13} /></Link></aside></div>
    {(lesson || error || loading) && <dialog ref={dialog} className="course-preview-panel" aria-label="강의 미리보기" onCancel={closePreview}><div><span className="section-kicker">미리보기</span><button className="course-close" aria-label="미리보기 닫기" autoFocus onClick={closePreview}><Icon name="close" /></button></div>{loading ? <p role="status">미리보기를 불러오고 있어요.</p> : error ? <p className="course-error" role="alert">{error}</p> : lesson && <><h2>{lesson.title}</h2>{course.isDemo && <p className="course-prelaunch-note">정식 강의가 아닌 구성 예시 미리보기입니다.</p>}{lesson.videoUrl && <video src={lesson.videoUrl} controls controlsList="nodownload" preload="metadata" />}<div className="course-lesson-body">{lesson.body}</div></>}</dialog>}
  </div>;
}
