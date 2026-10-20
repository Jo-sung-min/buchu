import "server-only";
import type { HomeFeed } from "./posts";

/** The front page fetches its posts on the server so the page arrives filled instead of showing a spinner. Null when the backend is slow or down; the browser then fetches as before. */
export async function getHomeFeed(): Promise<HomeFeed | null> {
  try {
    const backend = (process.env.BACKEND_URL || "http://localhost:8082").replace(/\/$/, "");
    const response = await fetch(`${backend}/api/posts/home`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    return await response.json() as HomeFeed;
  } catch {
    return null;
  }
}
