/* craft.ai — PWA Service Worker (network-first, bayat-bundle güvenli)

   Eski sürüm gezinme HTML'ini önbelleğe alıp her yenilemede BAYAT uygulama
   sunuyordu. Bu sürüm o hatayı YAPISAL OLARAK imkânsız kılar:

   • Gezinme (HTML): ÖNCE ağ. Çevrimiçiyken DAİMA taze HTML gelir → bundle
     referansları her zaman güncel. Yalnızca tamamen çevrimdışıyken son iyi
     sayfa yedeği gösterilir.
   • /_next/static/* + ikonlar/fontlar: içerik-hash'li ve değişmez → cache-first
     (güvenli; yeni dağıtım yeni hash üretir, eski cache activate'te silinir).
   • /api/* ve diğer her şey: doğrudan ağ (önbellek yok).

   Böylece kurulabilir bir PWA elde edilir ama bayat paket sorunu geri gelmez. */

const VERSION = "craft-v3";
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_FALLBACK = "/app";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa-icon") ||
    /\.(?:woff2?|ttf|otf|png|jpe?g|webp|svg|ico|gif)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Gezinme → network-first (çevrimiçiyken asla cache'den HTML). */
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(OFFLINE_FALLBACK, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match(OFFLINE_FALLBACK);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  /* Değişmez statik varlıklar → cache-first. */
  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })(),
    );
    return;
  }

  /* Diğer her şey (API dahil) → doğrudan ağ; SW karışmaz. */
});
