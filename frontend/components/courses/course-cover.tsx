import { courseCategories, type Course } from "@/lib/courses";
import { Icon } from "../icons";
import { safeContentUrl } from "../detail-content";

export function CourseCover({ course }: { course: Course }) {
  const image = safeContentUrl(course.thumbnailUrl, true);
  return <div className={`course-cover course-cover-${course.category.toLowerCase()}`}>
    {image ? <img src={image} alt={`${course.title} 강의 표지`} loading="lazy" /> : <><span className="course-cover-label">부업 클래스</span><strong>{courseCategories[course.category]}</strong><span className="course-cover-symbol" aria-hidden="true"><Icon name={course.category === "AFFILIATE" ? "link" : course.category === "AI" ? "spark" : course.category === "CONTENT" ? "book" : "arrow-up"} size={64} /></span></>}
  </div>;
}
