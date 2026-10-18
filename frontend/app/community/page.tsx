import Link from "next/link";
import type { Metadata } from "next";
import { PostList } from "@/components/community/post-list";
import { Icon } from "@/components/icons";
import { isPostCategory, postCategoryLabels, type PostSort } from "@/lib/posts";

export const metadata: Metadata = { title: "전체 글", description: "부업하는 사람들이 익명으로 경험과 질문, 일상 이야기를 나누는 공간입니다." };
const sorts = new Set<string>(["latest", "popular", "comments"]);
function first(value: string | string[] | undefined) { return typeof value === "string" ? value : undefined; }

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; category?: string | string[]; sort?: string | string[] }> }) {
  const params = await searchParams;
  const query = (first(params.q) || "").slice(0, 120);
  const category = isPostCategory(first(params.category)) ? first(params.category) as Exclude<Parameters<typeof PostList>[0]["initialCategory"], undefined | ""> : "";
  const sortParam = first(params.sort);
  const sort = (sortParam && sorts.has(sortParam) ? sortParam : "latest") as PostSort;
  return <div className="container post-page">
    <header className="topic-page-heading"><h1>{category ? postCategoryLabels[category] : "전체 글"}</h1><Link href={`/community/write${category ? `?category=${category}` : ""}`} className="button button-outline post-write-button">글쓰기 <Icon name="arrow-up" size={15} /></Link></header>
    <PostList key={`${query}|${category}|${sort}`} initialQuery={query} initialCategory={category} initialSort={sort} />
  </div>;
}
