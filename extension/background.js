// Background script — does the network call, because Firefox applies the host
// page's CSP to fetches made from content scripts (which blocks us on many sites).
const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "mizuki-speak") return;
  const base = String(msg.apiBase || "").replace(/\/$/, "");
  return fetch(`${base}/api/public/companion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(msg.payload),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, data: await res.json() };
    })
    .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }));
});
