/* Service worker artık KULLANILMIYOR. Eski sürüm gezinme HTML'ini önbelleğe
   alıp bayat uygulama sunuyordu. Bu fonksiyon yeni SW kaydetmez; bunun yerine
   mevcut tüm kayıtları düşürür ve cache'leri temizler ki kullanıcılar bayat
   paketten kurtulsun. (public/sw.js de kendini unregister eden bir kill-switch.) */

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const cleanup = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* yok say */ }
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* yok say */ }
  };

  if (document.readyState === "complete") cleanup();
  else window.addEventListener("load", cleanup, { once: true });
}

/* Lightweight online/offline notifier — emits a `craftai:online` /
   `craftai:offline` window event for any component that cares. */
export function watchConnection() {
  if (typeof window === "undefined") return () => { /* noop */ };
  const onOff = () => window.dispatchEvent(new Event("craftai:offline"));
  const onOn = () => window.dispatchEvent(new Event("craftai:online"));
  window.addEventListener("offline", onOff);
  window.addEventListener("online", onOn);
  return () => {
    window.removeEventListener("offline", onOff);
    window.removeEventListener("online", onOn);
  };
}
