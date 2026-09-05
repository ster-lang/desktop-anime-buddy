(() => {
  const DEFAULTS = Object.freeze({
    apiBase: 'https://desktop-anime-buddy.lovable.app', consentBase: '', enabled: true,
    mode: 'manual', sharePageContext: false, excludedSites: [], outfit: 'sweater',
    persona: 'enthusiastic', language: 'en', scale: 2, pos: null,
  });
  const MOODS = ['idle', 'happy', 'interested', 'thinking', 'flustered', 'jealous', 'sleepy'];
  const OUTFITS = ['sweater', 'school', 'yukata', 'hacker', 'beach', 'pyjamas', 'hoodie'];
  function serverBase(value) {
    const u = new URL(String(value).trim());
    if (u.username || u.password || u.search || u.hash) throw new Error('Use a server URL without credentials, query or fragment.');
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) {
      throw new Error('Use HTTPS, or HTTP on localhost for local development.');
    }
    return u.href.replace(/\/+$/, '');
  }
  function normal(host) { return String(host || '').toLowerCase().replace(/\.+$/g, ''); }
  function excluded(host, sites) {
    const h = normal(host);
    return (Array.isArray(sites) ? sites : []).some(site => { const s = normal(site); return h === s || h.endsWith('.' + s) || ('.' + h).endsWith('.' + s); });
  }
  function parseSites(value) {
    return [...new Set(value.split(/[\s,]+/).filter(Boolean).map(site => {
      if (!/^(localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(site) || site.includes('..')) throw new Error('Enter hostnames only, such as example.com (no URL paths or wildcards).');
      return site.toLowerCase();
    }))];
  }
  function clampPosition(pos, width, height, viewportWidth, viewportHeight) {
    const maxX = Math.max(0, viewportWidth - width), maxY = Math.max(0, viewportHeight - height);
    return {x: Math.max(0, Math.min(maxX, Number.isFinite(pos?.x) ? pos.x : maxX - 12)),
      y: Math.max(0, Math.min(maxY, Number.isFinite(pos?.y) ? pos.y : maxY - 12))};
  }
  globalThis.Mizuki = {DEFAULTS, MOODS, OUTFITS, serverBase, excluded, parseSites, clampPosition};
})();
