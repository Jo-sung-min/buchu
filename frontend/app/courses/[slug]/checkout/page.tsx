import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/course-server";
import { CourseCheckout } from "@/components/courses/course-checkout";
export const metadata: Metadata = { title: "강의 구매", robots: { index: false, follow: false }, referrer: "same-origin" };
export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ orderId?: string }> }) {
  const course = await getCourse((await params).slug);
  if (!course) notFound();
  const query = await searchParams;
  return <CourseCheckout course={course} resumeId={typeof query.orderId === "string" ? query.orderId : ""} />;
}
