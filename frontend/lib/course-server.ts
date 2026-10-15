import "server-only";
import type { Course } from "./courses";

const backend = () => (process.env.BACKEND_URL || "http://localhost:8082").replace(/\/$/, "");
export async function getCourses(): Promise<{ items: Course[]; unavailable: boolean }> {
  try {
    const response = await fetch(`${backend()}/api/courses`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Course catalog unavailable");
    const result = await response.json();
    if (!Array.isArray(result.items)) throw new Error("Invalid course catalog");
    return { items: result.items, unavailable: false };
  } catch { return { items: [], unavailable: true }; }
}
export async function getCourse(slug: string): Promise<Course | null> {
  const response = await fetch(`${backend()}/api/courses/${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("강의 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return response.json();
}
