"use client";

import Link from "next/link";
import { useState } from "react";
import { courseCategories, courseLevels, courseLessonCount, won, type Course, type CourseCategory } from "@/lib/courses";
import { CourseCover } from "./course-cover";
import { Icon } from "../icons";

const comparisonRows: [string, (course: Course) => string][] = [
  ["난이도", course => courseLevels[course.level]],
  ["주당 시간", course => `${course.weeklyHours}시간`],
  ["추가 실습비", course => won(course.startupCost)],
  ["강의료", course => course.status === "PUBLISHED" ? won(course.price) : "준비 중"],
  ["결과물", course => course.outcomes[0] || "준비 중"],
];

export function CourseCatalog({ courses, unavailable, initialQuery = "" }: { courses: Course[]; unavailable: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CourseCategory | "ALL">("ALL");
  const [beginner, setBeginner] = useState(false);
  const [short, setShort] = useState(false);
  const [noCost, setNoCost] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [comparison, setComparison] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const filtered = courses.filter(course =>
    (category === "ALL" || course.category === category) && (!beginner || course.level === "BEGINNER") &&
    (!short || course.weeklyHours <= 3) && (!noCost || course.startupCost === 0) &&
    [course.title, course.subtitle, course.instructorName, courseCategories[course.category], ...course.outcomes].join(" ").toLowerCase().includes(query.toLowerCase().trim())
  ).sort((a, b) => sort === "time" ? a.weeklyHours - b.weeklyHours : sort === "cost" ? a.startupCost - b.startupCost :
    Number(b.status === "PUBLISHED") - Number(a.status === "PUBLISHED") || Object.keys(courseCategories).indexOf(a.category) - Object.keys(courseCategories).indexOf(b.category) || a.title.localeCompare(b.title, "ko"));
  const selected = courses.filter(course => comparison.includes(course.id));
  function toggle(id: string) { setComparison(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 3 ? [...ids, id] : ids); }
  function reset() { setCategory("ALL"); setQuery(""); setBeginner(false); setShort(false); setNoCost(false); }

  return <div className="container courses-page courses-index">
    <div className="topic-page-heading"><h1>부업 클래스</h1><Link href="/classroom">내 강의실 <Icon name="chevron" size={14} /></Link></div>
    <section aria-label="강의 목록" id="course-list">
      <div className="course-category-tabs" aria-label="강의 분야">
        <button className={category === "ALL" ? "active" : ""} onClick={() => setCategory("ALL")} aria-pressed={category === "ALL"}>전체</button>
        {Object.entries(courseCategories).map(([value, label]) => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value as CourseCategory)} aria-pressed={category === value}>{label}</button>)}
      </div>
      <div className="course-toolbar">
        <div className="course-search"><Icon name="search" size={18} /><input aria-label="강의 검색" placeholder="강의·강사 검색" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />{query && <button aria-label="강의 검색어 지우기" onClick={() => setQuery("")}><Icon name="close" size={16} /></button>}</div>
        <div className="course-quick-filters"><button aria-pressed={beginner} className={beginner ? "active" : ""} onClick={() => setBeginner(!beginner)}>입문</button><button aria-pressed={short} className={short ? "active" : ""} onClick={() => setShort(!short)}>주 3시간 이내</button><button aria-pressed={noCost} className={noCost ? "active" : ""} onClick={() => setNoCost(!noCost)}>실습비 0원</button></div>
      </div>
      {showCompare && selected.length >= 2 && <section className="course-comparison" aria-label="선택한 강의 비교"><div className="course-comparison-heading"><h2>강의 비교</h2><button aria-label="비교 닫기" onClick={() => setShowCompare(false)}><Icon name="close" /></button></div><div className="course-table-scroll"><table><thead><tr><th scope="col">항목</th>{selected.map(course => <th key={course.id} scope="col"><Link href={`/courses/${course.slug}`}>{course.title}</Link></th>)}</tr></thead><tbody>{comparisonRows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{selected.map(course => <td key={course.id}>{value(course)}</td>)}</tr>)}</tbody></table></div></section>}
      <div className="course-results"><span role="status">{category === "ALL" ? "전체 강의" : courseCategories[category]} <b>{filtered.length}</b></span><div><button className="course-compare-trigger" disabled={comparison.length < 2} onClick={() => setShowCompare(!showCompare)}>비교 <span>{comparison.length}/3</span></button><select value={sort} onChange={event => setSort(event.target.value)} aria-label="강의 정렬"><option value="recommended">기본순</option><option value="time">시간 적은 순</option><option value="cost">실습비 낮은 순</option></select></div></div>
      {unavailable ? <div className="course-empty"><h3>강의를 불러오지 못했어요</h3><button className="button button-outline" onClick={() => window.location.reload()}>다시 불러오기</button></div> : filtered.length ? <div className="course-list">{filtered.map(course => <article className="course-list-row" key={course.id}>
        <Link href={`/courses/${course.slug}`} className="course-list-cover" aria-label={`${course.title} 상세`}><CourseCover course={course} /></Link>
        <div className="course-list-info"><div className="course-list-category">{courseCategories[course.category]}<span>·</span>{courseLevels[course.level]}</div><Link href={`/courses/${course.slug}`}><h2>{course.title}</h2></Link><div className="course-list-author">{course.isDemo ? "기획 예시" : course.instructorName}<span>·</span>{courseLessonCount(course)}개 수업</div><div className="course-list-facts">주 {course.weeklyHours}시간<span>·</span>실습비 {won(course.startupCost)}</div><div className="course-list-bottom"><strong>{course.status === "PUBLISHED" ? won(course.price) : "준비 중"}</strong><button className={`course-compare-button${comparison.includes(course.id) ? " active" : ""}`} onClick={() => toggle(course.id)} aria-pressed={comparison.includes(course.id)} aria-label={`${course.title} 비교 ${comparison.includes(course.id) ? "해제" : "선택"}`} disabled={!comparison.includes(course.id) && comparison.length >= 3}><Icon name={comparison.includes(course.id) ? "check" : "sliders"} size={14} />비교</button></div></div>
      </article>)}</div> : <div className="course-empty"><h3>조건에 맞는 강의가 없어요</h3><button className="button button-outline" onClick={reset}>필터 초기화</button></div>}
    </section>
  </div>;
}
