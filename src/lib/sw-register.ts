/* PWA service worker'ını kaydeder (public/sw.js — network-first, bayat-bundle
   güvenli). Kurulabilir uygulama + çevrimdışı yedek sağlar; gezinmede daima
   ağdan taze HTML çekildiği için eski "bayat paket" sorunu geri gelmez. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch { /* yok say */ }
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
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
