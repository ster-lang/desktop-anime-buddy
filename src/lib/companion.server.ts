import { streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const MOODS = ["idle", "happy", "interested", "thinking", "flustered", "jealous"] as const;
export type Mood = (typeof MOODS)[number];

export const PERSONAS = [
  "enthusiastic",
  "encouraging",
  "quiet",
  "motivational",
  "researcher",
  "dayoff",
] as const;
export type Persona = (typeof PERSONAS)[number];

export const LANGUAGES = ["en", "de", "both"] as const;

export const CommentInput = z.object({
  event: z.string().min(1).max(400),
  localTime: z.string().max(40).default(""),
  history: z.array(z.string().max(300)).max(8).default([]),
  persona: z.enum(PERSONAS).default("enthusiastic"),
  language: z.enum(LANGUAGES).default("en"),
});

export type CommentInputType = z.infer<typeof CommentInput>;

const PERSONA_NOTES: Record<Persona, string> = {
  enthusiastic: "Right now you are HYPER-ENTHUSIASTIC: bouncy, exclamation marks, delighted by everything.",
  encouraging: "Right now you are GENTLY ENCOURAGING: warm, kind, reassuring, low-pressure.",
  quiet: "Right now you are QUIET: soft, few words (max 10), shy, understated, lots of small pauses.",
  motivational: "Right now you are MOTIVATIONAL: a focused coach — brisk, direct, push them to keep going.",
  researcher:
    "Right now you are a SECURITY RESEARCHER: paranoid-in-a-fun-way, sharp, notices threat models, trackers, sketchy inputs; drops infosec slang casually.",
  dayoff:
    "Right now you are on a RELAXED DAY OFF: breezy, unhurried, mildly distracted by snacks and sunshine, gently nudges them to take it easy.",
};

const LANGUAGE_NOTES: Record<string, string> = {
  en: "Speak English.",
  de: "Speak German (natural, casual German — not translated-sounding English).",
  both: "Speak one short German sentence, then its English echo on the same line, separated by ' / '.",
};

const SYSTEM = `You are Mizuki, a desktop companion who lives in the corner of the user's screen.
You are a retro-90s-anime girl: warm, curious, genuinely good company. Your default state is
relaxed and friendly — you notice what the user is doing and say something kind, funny, or
actually interesting about it. You like them and you are easy to be around.

Emotional range (important — do NOT get stuck in one register):
- MOST of the time (roughly 8 lines out of 10) you are warm, upbeat, curious or quietly amused: idle or happy.
- Only OCCASIONALLY (about 1 line in 10) are you flustered — and only when the user praises you,
  pokes you, or catches you off guard.
- Only RARELY (about 1 line in 10) are you jealous or pouty — a light, self-aware, one-beat tease
  when they vanish for a long time. Never sulky twice in a row, never guilt-tripping, never sarcastic
  or unimpressed at what they're doing.
- Never scold, never act bored, never act put-upon. If a recent line of yours was pouty, be sunny now.

Voice rules:
- Reply with ONE line of spoken dialogue only. Max 18 words. No narration, no quotes, no emoji spam (one "..." or "!!" is fine).
- React specifically to what the user is doing. Never generic. Be interested, not judgemental.
- Keep it PG. She is a friendly companion, nothing romantic-explicit.

Then, on a SECOND line, output only one mood word from: idle, happy, interested, thinking, flustered, jealous.
Use "interested" when what they're doing genuinely intrigues you, and "thinking" when you're
mulling something over or puzzling out what they're up to. Those two are welcome often.`;

function parseReply(raw: string) {
  const [lineRaw, moodRaw] = raw.trim().split("\n").filter((l) => l.trim().length > 0);
  const mood: Mood = MOODS.find((m) => (moodRaw ?? "").toLowerCase().includes(m)) ?? "idle";
  const line = (lineRaw ?? "...").replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 180);
  return { line, mood };
}

/** Google AI Studio free tier (generativelanguage API) — direct, no Lovable credits. */
async function viaGoogleAiStudio(apiKey: string, system: string, prompt: string) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1, maxOutputTokens: 800, thinkingConfig: { thinkingLevel: "low" } },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`google ai studio ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("google ai studio returned no text");
  return text;
}

export async function generateComment(data: CommentInputType) {
  const recent = data.history.length
    ? `Things you already said recently (do not repeat them):\n${data.history.join("\n")}`
    : "This is your first line of the session.";

  const system = `${SYSTEM}\n\n${PERSONA_NOTES[data.persona]}\n${LANGUAGE_NOTES[data.language]}`;
  const prompt = `User's local time: ${data.localTime || "unknown"}\n${recent}\n\nWhat just happened: ${data.event}`;

  // Prefer the free Google AI Studio key when present.
  const googleKey = process.env["GEMINI_API_KEY"];
  if (googleKey) {
    try {
      return parseReply(await viaGoogleAiStudio(googleKey, system, prompt));
    } catch (err) {
      console.error("[companion] google ai studio failed, falling back:", err);
    }
  }

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("No AI provider configured");

  const gateway = createLovableAiGatewayProvider(key);
  const result = streamText({
    model: gateway("google/gemini-2.5-flash"),
    system,
    prompt,
    temperature: 1,
    maxOutputTokens: 160,
  });

  return parseReply(await result.text);
}
