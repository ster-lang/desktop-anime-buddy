// Mizuki content script — runs on every page, works in Firefox and Chromium.
const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  apiBase: "https://desktop-anime-buddy.lovable.app",
  enabled: true,
  chatty: true,
  outfit: "sweater",
  persona: "enthusiastic",
  language: "en",
  scale: 2,
  pos: null, // { x, y } top-left in px, null = default bottom-right
};

const MOODS = ["idle", "happy", "interested", "thinking", "flustered", "jealous"];
const OUTFITS = ["sweater", "school", "yukata", "hacker", "beach", "pyjamas"];
const BASE_WIDTH = 118;

let settings = { ...DEFAULTS };
let history = [];
let busy = false;
let lastActivity = Date.now();
let root, bubbleEl, textEl, spriteEl, inputEl;
let hideTimer;

function spriteUrl(mood) {
  const outfit = OUTFITS.includes(settings.outfit) ? settings.outfit : "sweater";
  const m = MOODS.includes(mood) ? mood : "idle";
  return api.runtime.getURL(`sprites/companion-${outfit}-${m}.png`);
}

function applyScale() {
  if (spriteEl) spriteEl.style.width = `${BASE_WIDTH * (Number(settings.scale) || 2)}px`;
}

function applyPosition() {
  if (!root) return;
  const p = settings.pos;
  if (p && typeof p.x === "number") {
    root.style.left = `${p.x}px`;
    root.style.top = `${p.y}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  } else {
    root.style.left = "auto";
    root.style.top = "auto";
    root.style.right = "12px";
    root.style.bottom = "12px";
  }
}

function makeDraggable() {
  let dragging = false;
  let moved = false;
  let dx = 0;
  let dy = 0;

  spriteEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const rect = root.getBoundingClientRect();
    dx = e.clientX - rect.left;
    dy = e.clientY - rect.top;
    dragging = true;
    moved = false;
    spriteEl.setPointerCapture(e.pointerId);
    root.classList.add("mizuki-dragging");
  });

  spriteEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    moved = true;
    const rect = root.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - dx), window.innerWidth - rect.width);
    const y = Math.min(Math.max(0, e.clientY - dy), window.innerHeight - rect.height);
    settings.pos = { x, y };
    applyPosition();
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("mizuki-dragging");
    try {
      spriteEl.releasePointerCapture(e.pointerId);
    } catch {}
    if (moved) api.storage.local.set({ pos: settings.pos });
    else onPoke();
  };
  spriteEl.addEventListener("pointerup", end);
  spriteEl.addEventListener("pointercancel", end);
}

function onPoke() {
  root.classList.toggle("mizuki-chatting");
  if (root.classList.contains("mizuki-chatting")) inputEl.focus();
  else speak("The user just poked you right on the head with their cursor. Usually be flustered or delighted.");
}

function build() {
  if (document.getElementById("mizuki-root")) return;

  root = document.createElement("div");
  root.id = "mizuki-root";

  bubbleEl = document.createElement("div");
  bubbleEl.id = "mizuki-bubble";
  bubbleEl.className = "mizuki-empty";
  const name = document.createElement("div");
  name.className = "mizuki-name";
  name.textContent = "Mizuki";
  textEl = document.createElement("div");
  bubbleEl.append(name, textEl);

  spriteEl = document.createElement("img");
  spriteEl.id = "mizuki-sprite";
  spriteEl.alt = "Mizuki";
  spriteEl.draggable = false;
  spriteEl.src = spriteUrl("idle");

  inputEl = document.createElement("input");
  inputEl.id = "mizuki-input";
  inputEl.placeholder = "tell her what you're up to...";
  inputEl.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") root.classList.remove("mizuki-chatting");
    if (e.key !== "Enter") return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    speak(`The user tells you: "${text}". React to it.`);
  });

  root.append(bubbleEl, spriteEl, inputEl);
  document.documentElement.appendChild(root);
  applyScale();
  applyPosition();
  makeDraggable();
}

let blinkTimer, unblinkTimer;

function scheduleBlink() {
  clearTimeout(blinkTimer);
  blinkTimer = setTimeout(
    () => {
      if (spriteEl && spriteEl.dataset.mood === "idle" && settings.enabled) {
        const back = spriteEl.src;
        const outfit = OUTFITS.includes(settings.outfit) ? settings.outfit : "sweater";
        spriteEl.src = api.runtime.getURL(`sprites/companion-${outfit}-blink.png`);
        unblinkTimer = setTimeout(() => {
          if (spriteEl.dataset.mood === "idle") spriteEl.src = back;
        }, 180);
      }
      scheduleBlink();
    },
    2500 + Math.random() * 4500,
  );
}

function say(line, mood) {
  if (!root) return;
  textEl.textContent = line;
  bubbleEl.classList.remove("mizuki-empty");
  bubbleEl.style.animation = "none";
  void bubbleEl.offsetWidth;
  bubbleEl.style.animation = "";
  spriteEl.dataset.mood = MOODS.includes(mood) ? mood : "idle";
  spriteEl.src = spriteUrl(mood);
  if (mood === "flustered") {
    spriteEl.classList.remove("mizuki-shake");
    void spriteEl.offsetWidth;
    spriteEl.classList.add("mizuki-shake");
  }
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => bubbleEl.classList.add("mizuki-empty"), 14000);
}

async function speak(event) {
  if (busy || !settings.enabled) return;
  busy = true;
  try {
    const reply = await api.runtime.sendMessage({
      type: "mizuki-speak",
      apiBase: settings.apiBase,
      payload: {
        event,
        persona: settings.persona,
        language: settings.language,
        localTime: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          weekday: "long",
        }),
        history: history.slice(-6),
      },
    });
    if (!reply || !reply.ok) throw new Error(reply ? reply.error : "no response");
    const data = reply.data;
    history = [...history, data.line].slice(-8);
    say(data.line, data.mood);
  } catch (err) {
    console.warn("[Mizuki] request failed:", err);
    say("...I can't reach home right now. Check my settings?", "flustered");
  } finally {
    busy = false;
  }
}

function pageContext() {
  const h1 = document.querySelector("h1");
  return `They are on "${document.title}" (${location.hostname})${h1 ? `, headline: "${h1.textContent.trim().slice(0, 90)}"` : ""}`;
}

function start() {
  build();
  if (!settings.enabled) {
    root.classList.add("mizuki-hidden");
    return;
  }
  root.classList.remove("mizuki-hidden");

  speak(`The user just opened a page. ${pageContext()}. Comment on what they're looking at.`);
  scheduleBlink();

  const bump = () => (lastActivity = Date.now());
  window.addEventListener("pointerdown", bump, true);
  window.addEventListener("keydown", bump, true);

  if (settings.chatty) {
    setInterval(() => {
      if (document.hidden || !settings.enabled) return;
      if (Date.now() - lastActivity > 90000) {
        lastActivity = Date.now();
        speak(`The user has been still and silent for a while. ${pageContext()}. Check on them.`);
      }
    }, 15000);
  }

  let leftAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      leftAt = Date.now();
      return;
    }
    const away = Math.round((Date.now() - leftAt) / 1000);
    lastActivity = Date.now();
    if (leftAt && away > 20) {
      speak(
        `The user disappeared into another tab or app for ${away} seconds and just came back to \"${document.title}\". Welcome them back warmly; only sometimes a light one-beat pout.`,
      );
    }
  });
}

api.storage.local.get(DEFAULTS).then((stored) => {
  settings = { ...DEFAULTS, ...stored };
  start();
});

api.storage.onChanged.addListener((changes) => {
  for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
  if (!root) return;
  root.classList.toggle("mizuki-hidden", !settings.enabled);
  if (changes.scale) applyScale();
  if (changes.pos) applyPosition();
  if (changes.outfit) spriteEl.src = spriteUrl(spriteEl.dataset.mood || "idle");
});
