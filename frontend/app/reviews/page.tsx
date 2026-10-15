import Link from "next/link";
import type { Metadata } from "next";
import { ReviewFeed } from "@/components/reviews/review-feed";

export const metadata: Metadata = { title: "익명 부업 평가", description: "직접 해본 사람들이 익명으로 남긴 부업 평가를 만나보세요." };

export default function ReviewsPage() {
  return <div className="review-index-page container"><Link href="/" className="review-back-link">← 모두의 마케터</Link><div className="review-index-heading"><div><h1>익명 부업 평가</h1></div><Link href="/reviews/write" className="review-button review-button-primary">후기 쓰기</Link></div><ReviewFeed /></div>;
}
