import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/companion")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
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
