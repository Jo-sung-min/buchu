import type { Metadata } from "next";
import { CommunityBoard } from "@/components/community-board";
import { getPrograms } from "@/lib/programs";
export const metadata: Metadata = { title: "부업 정보 — 부업 소개와 익명 후기" };
export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; view?: string | string[] }> }) {
  const [{ items }, params] = await Promise.all([getPrograms(), searchParams]);
  const view = params.view === "labor" || params.view === "reviews" ? params.view : "programs";
  return <CommunityBoard key={`${typeof params.q === "string" ? params.q : ""}|${view}`} programs={items} initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""} initialView={view} />;
}
