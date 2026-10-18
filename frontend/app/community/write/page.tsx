import Link from "next/link";
import type { Metadata } from "next";
import { PostForm } from "@/components/community/post-form";
import type { PostCategory } from "@/lib/posts";

export const metadata: Metadata = { title: "글쓰기", description: "익명으로 부업 경험과 질문을 나눠 보세요.", robots: { index: false, follow: true } };
const categories = new Set<string>(["FREE", "QUESTION", "TIP", "INCOME"]);

export default async function WritePostPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const params = await searchParams;
  const initial = typeof params.category === "string" && categories.has(params.category) ? params.category as PostCategory : "FREE";
  return <div className="review-write-page container"><Link href="/community" className="review-back-link">← 소통</Link><div className="review-write-heading"><h1>글쓰기</h1></div><PostForm initialCategory={initial} /></div>;
}
