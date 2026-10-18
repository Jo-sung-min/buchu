import Link from "next/link";
import type { Metadata } from "next";
import { PostForm } from "@/components/community/post-form";
import { isPostCategory } from "@/lib/posts";

export const metadata: Metadata = { title: "글쓰기", description: "익명으로 부업 경험과 질문을 나눠 보세요.", robots: { index: false, follow: true } };

export default async function WritePostPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const params = await searchParams;
  const candidate = typeof params.category === "string" ? params.category : undefined;
  const initial = isPostCategory(candidate) ? candidate : "FREE";
  return <div className="review-write-page container"><Link href="/community" className="review-back-link">← 소통</Link><div className="review-write-heading"><h1>글쓰기</h1></div><PostForm initialCategory={initial} /></div>;
}
