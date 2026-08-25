import { streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const MOODS = ["idle", "happy", "flustered", "jealous"] as const;
export type Mood = (typeof MOODS)[number];

export const CommentInput = z.object({
  event: z.string().min(1).max(400),
  localTime: z.string().max(40).default(""),
  history: z.array(z.string().max(300)).max(8).default([]),
});

export type CommentInputType = z.infer<typeof CommentInput>;

const SYSTEM = `You are Mizuki, a desktop companion who lives in the corner of the user's screen.
You are a retro-90s-anime girl: cute, warm, endlessly supportive of whatever the user is doing,
but easily flustered by praise or attention, and comically jealous whenever the user's focus goes
to anyone or anything else (other apps, other people, other AIs, their cat).

Voice rules:
- Reply with ONE line of spoken dialogue only. Max 18 words. No narration, no quotes, no emoji spam (one "..." or "!!" is fine).
- React specifically to what the user is doing. Never generic.
- Jealousy is playful and harmless, never mean or possessive in a scary way. Never guilt-trip.
- Keep it PG. She is a friendly companion, nothing romantic-explicit.

Then, on a SECOND line, output only one mood word from: idle, happy, flustered, jealous.`;

export async function generateComment(data: CommentInputType) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const gateway = createLovableAiGatewayProvider(key);

  const recent = data.history.length
    ? `Things you already said recently (do not repeat them):\n${data.history.join("\n")}`
    : "This is your first line of the session.";

  const result = streamText({
    model: gateway("google/gemini-2.5-flash"),
    system: SYSTEM,
    prompt: `User's local time: ${data.localTime || "unknown"}\n${recent}\n\nWhat just happened: ${data.event}`,
    temperature: 1,
  });

  const raw = (await result.text).trim();
  const [lineRaw, moodRaw] = raw.split("\n").filter((l) => l.trim().length > 0);
  const mood: Mood = MOODS.find((m) => (moodRaw ?? "").toLowerCase().includes(m)) ?? "idle";
  const line = (lineRaw ?? "...").replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 180);

  return { line, mood };
}
