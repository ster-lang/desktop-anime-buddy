const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  apiBase: "https://desktop-anime-buddy.lovable.app",
  enabled: true,
  chatty: true,
  outfit: "sweater",
  persona: "enthusiastic",
  language: "en",
  scale: 2,
  pos: null,
};

const $ = (id) => document.getElementById(id);
const enabled = $("enabled");
const chatty = $("chatty");
const outfit = $("outfit");
const persona = $("persona");
const language = $("language");
const scale = $("scale");
const scaleVal = $("scaleVal");
const apiBase = $("apiBase");

api.storage.local.get(DEFAULTS).then((s) => {
  enabled.checked = s.enabled;
  chatty.checked = s.chatty;
  outfit.value = s.outfit;
  persona.value = s.persona;
  language.value = s.language;
  scale.value = s.scale;
  scaleVal.textContent = Number(s.scale).toFixed(1);
  apiBase.value = s.apiBase;
});

enabled.addEventListener("change", () => api.storage.local.set({ enabled: enabled.checked }));
chatty.addEventListener("change", () => api.storage.local.set({ chatty: chatty.checked }));
outfit.addEventListener("change", () => api.storage.local.set({ outfit: outfit.value }));
persona.addEventListener("change", () => api.storage.local.set({ persona: persona.value }));
language.addEventListener("change", () => api.storage.local.set({ language: language.value }));
scale.addEventListener("input", () => {
  scaleVal.textContent = Number(scale.value).toFixed(1);
  api.storage.local.set({ scale: Number(scale.value) });
});
apiBase.addEventListener("change", () => api.storage.local.set({ apiBase: apiBase.value.trim() }));
$("resetPos").addEventListener("click", () => api.storage.local.set({ pos: null }));
