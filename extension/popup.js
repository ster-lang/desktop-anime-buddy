const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  apiBase: "https://project--597808e0-745c-45f7-bbcf-1e05f1cc90f7.lovable.app",
  enabled: true,
  chatty: true,
};

const enabled = document.getElementById("enabled");
const chatty = document.getElementById("chatty");
const apiBase = document.getElementById("apiBase");

api.storage.local.get(DEFAULTS).then((s) => {
  enabled.checked = s.enabled;
  chatty.checked = s.chatty;
  apiBase.value = s.apiBase;
});

enabled.addEventListener("change", () => api.storage.local.set({ enabled: enabled.checked }));
chatty.addEventListener("change", () => api.storage.local.set({ chatty: chatty.checked }));
apiBase.addEventListener("change", () => api.storage.local.set({ apiBase: apiBase.value.trim() }));
