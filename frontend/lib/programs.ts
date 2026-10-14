import "server-only";
import catalog from "../../data/programs.json";
import type { Program } from "./types";

export async function getPrograms(): Promise<{ items: Program[]; total: number; updatedAt: string }> {
  try {
    const backend = (process.env.BACKEND_URL || "http://localhost:8082").replace(/\/$/, "");
    const response = await fetch(`${backend}/api/programs`, {
      cache: "no-store", signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error(`Catalog: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Invalid catalog response");
    return data;
  } catch {
    // The same curated catalog powers both apps, including frontend-only development.
    const items = catalog.programs as Program[];
    return { items, total: items.length, updatedAt: catalog.updatedAt };
  }
}

export async function getProgram(slug: string) {
  const { items } = await getPrograms();
  return items.find((program) => program.slug === slug);
}
