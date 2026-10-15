import Link from "next/link";
import type { Metadata } from "next";
import { ReviewForm } from "@/components/reviews/review-form";
import { getPrograms } from "@/lib/programs";

export const metadata: Metadata = { title: "익명 후기 쓰기", description: "직접 해본 부업의 솔직한 경험을 익명으로 나눠보세요.", robots: { index: false, follow: true } };

export default async function WriteReviewPage({ searchParams }: { searchParams: Promise<{ program?: string | string[] }> }) {
  const [{ items }, query] = await Promise.all([getPrograms(), searchParams]);
  const programs = items.filter((program) => !program.board || program.board === "MARKETER").map(({ slug, name }) => ({ slug, name }));
  const initialProgramSlug = typeof query.program === "string" ? query.program : undefined;
  return <div className="review-write-page container"><Link href="/reviews" className="review-back-link">← 익명 후기</Link><div className="review-write-heading"><h1>후기 쓰기</h1></div><ReviewForm programs={programs} initialProgramSlug={initialProgramSlug} /></div>;
}
