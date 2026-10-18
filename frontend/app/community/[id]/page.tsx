import Link from "next/link";
import type { Metadata } from "next";
import { PostDetail } from "@/components/community/post-detail";

export const metadata: Metadata = { title: "소통 글", robots: { index: false, follow: true } };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="review-write-page container post-detail-page"><Link href="/community" className="review-back-link">← 소통</Link><PostDetail id={id} /></div>;
}
