import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

// In-memory sliding window (best-effort; instances are ephemeral).
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function allow(ip: string) {
  const now = Date.now();
  const hits = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  HITS.set(ip, hits);
  if (HITS.size > 5000) HITS.clear();
  return hits.length <= MAX_PER_WINDOW;
}



export const Route = createFileRoute("/api/public/companion")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        // Basic abuse control: this endpoint is intentionally unauthenticated
        // (the extension runs on any site), so cap request size and per-IP rate.
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (!allow(ip)) {
          return new Response(JSON.stringify({ error: "slow down" }), {
            status: 429,
            headers: { ...CORS, "content-type": "application/json", "retry-after": "20" },
          });
        }
        const len = Number(request.headers.get("content-length") ?? "0");
        if (len > 8000) {
          return new Response(JSON.stringify({ error: "too large" }), {
            status: 413,
            headers: { ...CORS, "content-type": "application/json" },
          });
        }
        const { CommentInput, generateComment } = await import("@/lib/companion.server");

        try {
          const body = await request.json();
          const data = CommentInput.parse(body);
          const result = await generateComment(data);
          return new Response(JSON.stringify(result), {
            headers: { ...CORS, "content-type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ error: "bad request" }), {
            status: 400,
            headers: { ...CORS, "content-type": "application/json" },
          });
        }
      },
    },
  },
});
