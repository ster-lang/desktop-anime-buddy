import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import idleSprite from "@/assets/companion-idle.png";
import happySprite from "@/assets/companion-happy.png";
import flusteredSprite from "@/assets/companion-flustered.png";
import jealousSprite from "@/assets/companion-jealous.png";
import schoolIdle from "@/assets/companion-school-idle.png";
import schoolHappy from "@/assets/companion-school-happy.png";
import schoolFlustered from "@/assets/companion-school-flustered.png";
import schoolJealous from "@/assets/companion-school-jealous.png";
import yukataIdle from "@/assets/companion-yukata-idle.png";
import yukataHappy from "@/assets/companion-yukata-happy.png";
import yukataFlustered from "@/assets/companion-yukata-flustered.png";
import yukataJealous from "@/assets/companion-yukata-jealous.png";
import hackerIdle from "@/assets/companion-hacker-idle.png";
import hackerHappy from "@/assets/companion-hacker-happy.png";
import hackerFlustered from "@/assets/companion-hacker-flustered.png";
import hackerJealous from "@/assets/companion-hacker-jealous.png";
import beachIdle from "@/assets/companion-beach-idle.png";
import beachHappy from "@/assets/companion-beach-happy.png";
import beachFlustered from "@/assets/companion-beach-flustered.png";
import beachJealous from "@/assets/companion-beach-jealous.png";
import { getCompanionComment } from "@/lib/companion.functions";

type Mood = "idle" | "happy" | "flustered" | "jealous";
type Outfit = "sweater" | "school" | "yukata" | "hacker" | "beach";
type Persona = "enthusiastic" | "encouraging" | "quiet" | "motivational";
type Language = "en" | "de" | "both";

const SPRITES: Record<Outfit, Record<Mood, string>> = {
  sweater: {
    idle: idleSprite,
    happy: happySprite,
    flustered: flusteredSprite,
    jealous: jealousSprite,
  },
  school: {
    idle: schoolIdle,
    happy: schoolHappy,
    flustered: schoolFlustered,
    jealous: schoolJealous,
  },
  yukata: {
    idle: yukataIdle,
    happy: yukataHappy,
    flustered: yukataFlustered,
    jealous: yukataJealous,
  },
};

const OUTFIT_LABELS: Record<Outfit, string> = {
  sweater: "Cozy sweater",
  school: "Sailor uniform",
  yukata: "Summer yukata",
};

const PERSONA_LABELS: Record<Persona, string> = {
  enthusiastic: "Enthusiastic",
  encouraging: "Encouraging",
  quiet: "Quiet",
  motivational: "Motivational",
};

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
  both: "DE / EN",
};

const IDLE_AFTER_MS = 50_000;
const selectClass =
  "font-display rounded-sm border-2 border-ink bg-bubble px-2 py-1 text-[0.65rem] uppercase tracking-widest text-ink outline-none";

export function Companion() {
  const askCompanion = useServerFn(getCompanionComment);

  const [mood, setMood] = useState<Mood>("idle");
  const [line, setLine] = useState("...");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [outfit, setOutfit] = useState<Outfit>("sweater");
  const [persona, setPersona] = useState<Persona>("enthusiastic");
  const [language, setLanguage] = useState<Language>("en");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const historyRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const shellRef = useRef<HTMLDivElement>(null);
  const personaRef = useRef({ persona, language });
  personaRef.current = { persona, language };

  const speak = useCallback(
    async (event: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setThinking(true);
      try {
        const result = await askCompanion({
          data: {
            event,
            persona: personaRef.current.persona,
            language: personaRef.current.language,
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

  // Drag her anywhere on screen
  const dragState = useRef({ dx: 0, dy: 0, moved: false });
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current.moved = true;
    setPos({
      x: Math.min(Math.max(0, e.clientX - dragState.current.dx), window.innerWidth - rect.width),
      y: Math.min(Math.max(0, e.clientY - dragState.current.dy), window.innerHeight - rect.height),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!dragState.current.moved) {
      void speak("The user just poked you right on the head with their cursor. Be flustered.");
    }
  };

  return (
    <div
      ref={shellRef}
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
          : { right: "1rem", bottom: "1rem" }
      }
      className="pointer-events-none fixed z-40 flex w-[min(92vw,30rem)] flex-col items-end gap-3"
    >
      <div
        key={line}
        className="speech-bubble animate-bubble-pop pointer-events-auto relative w-full rounded-md px-4 py-3"
      >
        <p className="font-display text-[0.7rem] uppercase tracking-[0.2em] opacity-60">Mizuki</p>
        <p className="mt-1 text-base leading-snug">
          {thinking ? <span className="opacity-60">...</span> : line}
        </p>
        <span className="absolute -bottom-2 right-16 h-3 w-3 rotate-45 border-b-2 border-r-2 border-ink bg-bubble" />
      </div>

      <img
        src={SPRITES[outfit][mood]}
        alt={`Mizuki wearing her ${OUTFIT_LABELS[outfit].toLowerCase()}, looking ${mood}`}
        width={768}
        height={1024}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`pointer-events-auto h-auto w-72 touch-none select-none drop-shadow-[6px_10px_0_oklch(0.16_0.03_250_/_0.4)] sm:w-[26rem] ${
          dragging
            ? "cursor-grabbing"
            : mood === "flustered"
              ? "animate-fluster-shake cursor-grab"
              : "animate-float-idle cursor-grab"
        }`}
      />

      <div className="pointer-events-auto flex w-full flex-wrap items-center justify-end gap-2">
        <select
          aria-label="Outfit"
          value={outfit}
          onChange={(e) => setOutfit(e.target.value as Outfit)}
          className={selectClass}
        >
          {(Object.keys(OUTFIT_LABELS) as Outfit[]).map((o) => (
            <option key={o} value={o}>
              {OUTFIT_LABELS[o]}
            </option>
          ))}
        </select>
        <select
          aria-label="Personality"
          value={persona}
          onChange={(e) => setPersona(e.target.value as Persona)}
          className={selectClass}
        >
          {(Object.keys(PERSONA_LABELS) as Persona[]).map((p) => (
            <option key={p} value={p}>
              {PERSONA_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className={selectClass}
        >
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={onSubmit}
        className="panel pointer-events-auto flex w-full items-center gap-2 rounded-md p-2"
      >
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
  );
}
