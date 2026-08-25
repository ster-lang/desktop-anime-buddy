import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import idleSprite from "@/assets/companion-idle.png";
import happySprite from "@/assets/companion-happy.png";
import flusteredSprite from "@/assets/companion-flustered.png";
import jealousSprite from "@/assets/companion-jealous.png";
import { getCompanionComment } from "@/lib/companion.functions";

type Mood = "idle" | "happy" | "flustered" | "jealous";

const SPRITES: Record<Mood, string> = {
  idle: idleSprite,
  happy: happySprite,
  flustered: flusteredSprite,
  jealous: jealousSprite,
};

const IDLE_AFTER_MS = 50_000;

export function Companion() {
  const askCompanion = useServerFn(getCompanionComment);

  const [mood, setMood] = useState<Mood>("idle");
  const [line, setLine] = useState("...");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const historyRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  const speak = useCallback(
    async (event: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setThinking(true);
      try {
        const result = await askCompanion({
          data: {
            event,
            localTime: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              weekday: "long",
            } as Intl.DateTimeFormatOptions),
            history: historyRef.current.slice(-6),
          },
        });
        historyRef.current = [...historyRef.current, result.line].slice(-8);
        setLine(result.line);
        setMood(result.mood as Mood);
      } catch {
        setLine("...my connection hiccuped. Say that again?");
        setMood("flustered");
      } finally {
        setThinking(false);
        busyRef.current = false;
      }
    },
    [askCompanion],
  );

  // First greeting
  useEffect(() => {
    void speak("The user just sat down at their desk and you appeared on their screen. Greet them.");
  }, [speak]);

  // Idle noticing
  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActivityRef.current > IDLE_AFTER_MS) {
        lastActivityRef.current = Date.now();
        void speak("The user has gone completely quiet and still for almost a minute. Check on them.");
      }
    }, 10_000);

    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.clearInterval(timer);
    };
  }, [speak]);

  // Jealousy when they leave the tab
  useEffect(() => {
    let leftAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        leftAt = Date.now();
        return;
      }
      const away = Math.round((Date.now() - leftAt) / 1000);
      if (leftAt && away > 8) {
        void speak(
          `The user switched away to another tab or app for ${away} seconds and just came back. Be jealous about whatever had their attention.`,
        );
      }
      lastActivityRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [speak]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void speak(`The user tells you: "${text}". React to it.`);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end px-4 pb-4 sm:px-8">
      <div className="pointer-events-auto flex w-full max-w-md flex-col items-end gap-3">
        <div
          key={line}
          className="speech-bubble animate-bubble-pop relative w-full rounded-md px-4 py-3"
        >
          <p className="font-display text-[0.7rem] uppercase tracking-[0.2em] opacity-60">
            Mizuki
          </p>
          <p className="mt-1 text-base leading-snug">
            {thinking ? <span className="opacity-60">...</span> : line}
          </p>
          <span className="absolute -bottom-2 right-16 h-3 w-3 rotate-45 border-b-2 border-r-2 border-ink bg-bubble" />
        </div>

        <button
          type="button"
          aria-label="Poke Mizuki"
          onClick={() =>
            void speak("The user just poked you right on the head with their cursor. Be flustered.")
          }
          className={`w-40 shrink-0 transition-transform hover:scale-[1.03] sm:w-52 ${
            mood === "flustered" ? "animate-fluster-shake" : "animate-float-idle"
          }`}
        >
          <img
            src={SPRITES[mood]}
            alt={`Mizuki looking ${mood}`}
            width={768}
            height={1024}
            className="h-auto w-full drop-shadow-[6px_10px_0_oklch(0.16_0.03_250_/_0.4)]"
          />
        </button>

        <form onSubmit={onSubmit} className="panel flex w-full items-center gap-2 rounded-md p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="tell her what you're up to..."
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-card-foreground outline-none placeholder:text-card-foreground/50"
          />
          <button
            type="submit"
            disabled={thinking}
            className="font-display rounded-sm border-2 border-ink bg-primary px-3 py-1 text-xs uppercase tracking-widest text-primary-foreground transition-transform active:translate-y-px disabled:opacity-50"
          >
            Say
          </button>
        </form>
      </div>
    </div>
  );
}
