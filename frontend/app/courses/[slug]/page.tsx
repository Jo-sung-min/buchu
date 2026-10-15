import { notFound } from "next/navigation";
import { getCourse } from "@/lib/course-server";
import { CourseDetail } from "@/components/courses/course-detail";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const course = await getCourse(slug); return { title: course?.title || "강의 찾기", description: course?.subtitle }; }
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const course = await getCourse(slug); if (!course) notFound(); return <CourseDetail course={course} />; }
