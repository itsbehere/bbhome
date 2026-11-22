// BB Home update helper: always asks the site for the newest version (skipping the browser's 10-minute cache),
// uses the saved copy only when offline, and refreshes open BB Home windows when a new version is installed.
const CACHE = "bbhome-v13";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon-32.png", "./emojis.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "no-cache" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })().then(() => {
    // Runs after activation has finished (a reload started before that would wait for it forever).
    // Newer windows answer and refresh themselves at a safe moment; older windows can't answer,
    // so they are refreshed from here.
    setTimeout(async () => {
      const wins = await self.clients.matchAll({ type: "window" });
      for (const c of wins) {
        let answered = false;
        const ch = new MessageChannel();
        ch.port1.onmessage = () => { answered = true; };
        try { c.postMessage({ t: "bb-update" }, [ch.port2]); } catch {}
        setTimeout(() => { if (!answered) c.navigate(c.url).catch(() => {}); }, 2500);
      }
    }, 100);
  }));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // "no-cache" = check with the site every time (a quick "not changed" answer when nothing is new)
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
});
