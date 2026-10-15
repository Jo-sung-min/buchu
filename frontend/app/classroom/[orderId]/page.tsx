import type { Metadata } from "next";
import { CoursePlayer } from "@/components/courses/course-player";

export const metadata: Metadata = { title: "강의 학습하기", robots: { index: false, follow: false } };

export default async function CoursePlayerPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <CoursePlayer orderId={orderId} />;
}
