import { HomeFeed } from "@/components/home-feed";
import { getPrograms } from "@/lib/programs";
import { getHomeFeed } from "@/lib/posts-server";
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [{ items }, params, initialHome] = await Promise.all([getPrograms(), searchParams, getHomeFeed()]);
  return <HomeFeed key={typeof params.q === "string" ? params.q : ""} programs={items} initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""} initialHome={initialHome} />;
}
