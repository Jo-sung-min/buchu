import { CommunityBoard } from "@/components/community-board";
import { getPrograms } from "@/lib/programs";
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [{ items }, params] = await Promise.all([getPrograms(), searchParams]);
  return <CommunityBoard key={typeof params.q === "string" ? params.q : ""} programs={items} initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""} />;
}
