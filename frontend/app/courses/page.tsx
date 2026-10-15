import type { Metadata } from "next";
import { getCourses } from "@/lib/course-server";
import { CourseCatalog } from "@/components/courses/course-catalog";
export const metadata: Metadata = { title: "부업 클래스", description: "내 시간과 초기 비용에 맞는 부업 전용 강의. 제휴마케팅부터 콘텐츠, 온라인 판매, 디지털 상품과 AI 활용까지." };
export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ items, unavailable }, query] = await Promise.all([getCourses(), searchParams]);
  return <CourseCatalog key={typeof query.q === "string" ? query.q : ""} courses={items} unavailable={unavailable} initialQuery={typeof query.q === "string" ? query.q.slice(0, 120) : ""} />;
}
