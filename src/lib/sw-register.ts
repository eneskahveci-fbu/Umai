// ── Service Worker kayıt ve çevrimiçi/çevrimdışı izleme ──

let online = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<(online: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    online = true;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener("offline", () => {
    online = false;
    listeners.forEach((fn) => fn(false));
  });
}

export function isOnline(): boolean {
  return online;
}

export function watchConnection(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function registerSW(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("[SW] registered");
      })
      .catch((err) => {
        console.warn("[SW] registration failed:", err);
      });
  });
}
