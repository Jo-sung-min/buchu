import type { Metadata } from "next";
import { CommunityBoard } from "@/components/community-board";
import { getPrograms } from "@/lib/programs";
export const metadata: Metadata = { title: "기업 홍보 — 기업 소개·인재 모집" };
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [{ items }, params] = await Promise.all([getPrograms(), searchParams]);
  return <CommunityBoard key={typeof params.q === "string" ? params.q : ""} programs={items} board="HELP" initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""} />;
}
