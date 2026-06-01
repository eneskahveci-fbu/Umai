/* Minimal service worker — offline shell + network-first for API.
   Strategy:
   - precache the bare app shell so /app loads when offline
   - network-first for /api/* (don't serve stale AI answers)
   - cache-first for /_next/static/* (immutable hashed assets)
   - fall back to a tiny offline page for navigation requests when net is dead */

const CACHE_NAME = "craft-ai-v2";
const SHELL_URLS = ["/manifest.webmanifest"];
const OFFLINE_HTML = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Çevrimdışı · craft.ai</title><style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:#0e0e13;color:#ececf1}body{display:grid;place-items:center;text-align:center;padding:2rem}h1{font-size:1.5rem;margin:0 0 .5rem;background:linear-gradient(120deg,#9d7bff,#c4b1ff);-webkit-background-clip:text;background-clip:text;color:transparent}p{margin:0 0 1rem;color:#9a9ab0;font-size:.9rem;max-width:28rem;line-height:1.6}button{padding:.6rem 1.2rem;border-radius:.75rem;background:#7c5cff;color:white;font-weight:700;border:0;cursor:pointer;font-size:.85rem}</style></head><body><div><h1>İnternet yok</h1><p>craft.ai tarayıcına yüklenmiş ama yeni AI istekleri için bağlantı gerekli. Bağlantı geri geldiğinde yenile.</p><button onclick="location.reload()">Yenile</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* API: network-first, no fallback */
  if (url.pathname.startsWith("/api/")) return;

  /* Hashed static assets — cache-first */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        }),
      ),
    );
    return;
  }

  /* Navigations: ağ öncelikli, ASLA HTML önbelleğe alma. Önceki sürüm gezinme
     HTML'ini cache'leyip yenilemede bayat kabuk (eski /app) sunuyordu; bu da
     "yenileyince eski içerik / boş skill listesi" sorununa yol açıyordu.
     Artık sadece ağ başarısız olursa (gerçekten çevrimdışı) yedeğe düşeriz. */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response(OFFLINE_HTML, {
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        });
      }),
    );
    return;
  }
});
