import Link from "next/link";
import type { Metadata } from "next";
import { PostList } from "@/components/community/post-list";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "소통", description: "부업하는 사람들이 익명으로 경험과 질문, 꿀팁을 나누는 소통 공간입니다." };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  return <div className="container post-page">
    <header className="topic-page-heading"><h1>소통</h1><Link href="/community/write" className="button button-outline post-write-button">글쓰기 <Icon name="arrow-up" size={15} /></Link></header>
    <PostList key={query} initialQuery={query} />
  </div>;
}
