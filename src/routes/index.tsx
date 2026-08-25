import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Companion } from "@/components/Companion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mizuki — Your Retro Anime Desktop Companion" },
      {
        name: "description",
        content:
          "A cute 90s-anime companion who lives in the corner of your screen, cheers you on, gets flustered, and sulks when you switch tabs.",
      },
      { property: "og:title", content: "Mizuki — Your Retro Anime Desktop Companion" },
      {
        property: "og:description",
        content:
          "A cute 90s-anime companion who lives in the corner of your screen, cheers you on, gets flustered, and sulks when you switch tabs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <span className="font-display text-sm tabular-nums">
      {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
    </span>
  );
}

function Index() {
  return (
    <main className="wallpaper crt relative min-h-screen overflow-hidden">
      <header className="relative z-10 flex items-center justify-between border-b-2 border-ink bg-sidebar px-4 py-2">
        <span className="font-display text-sm uppercase tracking-[0.3em] text-sidebar-foreground">
          mizuki.exe
        </span>
        <Clock />
      </header>

      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-[26rem] pt-16 sm:pb-72">
        <h1 className="font-display text-3xl leading-tight text-foreground sm:text-5xl">
          She lives in the corner
          <br />
          of your screen.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
          Mizuki watches what you're doing, cheers you on, short-circuits when you compliment her,
          and gets openly jealous the second another tab steals your attention.
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { k: "Poke her", v: "click the sprite" },
            { k: "Talk to her", v: "type below" },
            { k: "Leave the tab", v: "she'll notice" },
          ].map((item) => (
            <li key={item.k} className="panel rounded-md px-3 py-3">
              <p className="font-display text-xs uppercase tracking-widest">{item.k}</p>
              <p className="mt-1 text-sm opacity-70">{item.v}</p>
            </li>
          ))}
        </ul>
      </section>

      <Companion />
    </main>
  );
}
