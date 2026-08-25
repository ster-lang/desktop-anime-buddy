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

        <div className="panel mt-10 rounded-md p-4">
          <h2 className="font-display text-sm uppercase tracking-[0.25em]">
            Take her to every tab
          </h2>
          <p className="mt-2 text-sm opacity-75">
            A Firefox / Chromium extension that floats Mizuki in the corner of every page you
            browse. She reads the page title, sulks when you tab away, and you can chat with her
            by clicking the sprite.
          </p>
          <button
            type="button"
            onClick={downloadExtension}
            className="font-display mt-4 rounded-sm border-2 border-ink bg-primary px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground transition-transform active:translate-y-px"
          >
            Download extension (.zip)
          </button>
          <ol className="mt-4 space-y-1 text-sm opacity-75">
            <li>1. Unzip it somewhere permanent.</li>
            <li>
              2. Firefox: open <code>about:debugging#/runtime/this-firefox</code> → Load Temporary
              Add-on → pick <code>manifest.json</code>. (Permanent install needs a signed build —
              or use Firefox Developer Edition with{" "}
              <code>xpinstall.signatures.required = false</code>.)
            </li>
            <li>
              3. Chromium: <code>chrome://extensions</code> → Developer mode → Load unpacked.
            </li>
            <li>4. Click the toolbar icon to toggle her or point her at another server.</li>
          </ol>
        </div>
      </section>


      <Companion />
    </main>
  );
}
