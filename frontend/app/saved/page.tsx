import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { getPrograms } from "@/lib/programs";
export const metadata: Metadata = { title: "관심 부업" };
export default async function SavedPage() {
  const { items } = await getPrograms();
  return <Catalog programs={items} savedOnly />;
}
