import { adsenseClient, adsenseEnabled } from "@/lib/adsense";

export const dynamic = "force-static";

/** AdSense verifies sellers through /ads.txt; the publisher id is the client id without its "ca-" prefix. */
export function GET() {
  if (!adsenseEnabled) return new Response("Not Found", { status: 404 });
  return new Response(`google.com, ${adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
