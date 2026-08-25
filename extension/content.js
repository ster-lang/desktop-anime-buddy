// Mizuki content script — runs on every page, works in Firefox and Chromium.
const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  apiBase: "https://desktop-anime-buddy.lovable.app",
  enabled: true,
  chatty: true,
};

const MOODS = ["idle", "happy", "flustered", "jealous"];

let settings = { ...DEFAULTS };
let history = [];
let busy = false;
let lastActivity = Date.now();
let root, bubbleEl, textEl, spriteEl, inputEl;
let hideTimer;

function spriteUrl(mood) {
  return api.runtime.getURL(`sprites/companion-${MOODS.includes(mood) ? mood : "idle"}.png`);
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
  spriteEl.src = spriteUrl("idle");
  spriteEl.addEventListener("click", () => {
    root.classList.toggle("mizuki-chatting");
    if (root.classList.contains("mizuki-chatting")) inputEl.focus();
    else speak("The user just poked you right on the head with their cursor. Be flustered.");
  });

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
}

function say(line, mood) {
  if (!root) return;
  textEl.textContent = line;
  bubbleEl.classList.remove("mizuki-empty");
  bubbleEl.style.animation = "none";
  void bubbleEl.offsetWidth;
  bubbleEl.style.animation = "";
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
        `The user disappeared into another tab or app for ${away} seconds and just came back to "${document.title}". Be jealous.`,
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
  if (root) root.classList.toggle("mizuki-hidden", !settings.enabled);
});
