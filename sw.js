/* Tara service worker — offline app shell, cached photos/tiles, notification clicks.
   Bump VERSION when you publish changes. */
const VERSION = "tara-v10";
const RUNTIME = "tara-runtime-v1";
const CORE = [
  "./", "./index.html", "./offline.html", "./manifest.webmanifest",
  "./css/tokens.css", "./css/app.css",
  "./js/config.js", "./js/core.js", "./js/services.js", "./js/cloud.js", "./js/planner.js", "./js/views.js", "./js/main.js",
  "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css",
  "./icons/favicon.svg", "./icons/ka-logo.svg", "./icons/tara-192.png", "./icons/tara-512.png", "./icons/tara-apple-touch.png",
];
const RUNTIME_MAX = 250;

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser cache so a new version never stores old files
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - RUNTIME_MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./offline.html")))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // app files: newest version from the network when online (fast fallback to the saved copy offline)
    e.respondWith(caches.open(VERSION).then((c) => {
      const net = fetch(new Request(req, { cache: "no-cache" })).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
      const slow = new Promise((ok) => setTimeout(ok, 3500)).then(() => c.match(req, { ignoreSearch: true }));
      return Promise.race([net, slow.then((hit) => hit || net)]).catch(() => c.match(req, { ignoreSearch: true }));
    }));
    return;
  }

  // fonts, map tiles and place photos: stale-while-revalidate into a capped runtime cache
  if (/fonts\.(googleapis|gstatic)\.com$|tile\.openstreetmap\.org$|upload\.wikimedia\.org$/.test(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) { c.put(req, res.clone()); trim(c); } return res; }).catch(() => hit);
      return hit || net;
    })));
  }
  // API calls (search, places, weather) go to the network; the app caches results itself.
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "#/trips";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate ? c.navigate("./" + target) : null; return c.focus(); } }
    return self.clients.openWindow("./" + target);
  }));
});
