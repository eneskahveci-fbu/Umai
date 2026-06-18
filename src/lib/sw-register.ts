/* PWA service worker'ını kaydeder (public/sw.js — network-first, bayat-bundle
   güvenli). Kurulabilir uygulama + çevrimdışı yedek sağlar; gezinmede daima
   ağdan taze HTML çekildiği için eski "bayat paket" sorunu geri gelmez. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  /* Yeni sürüm dağıtıldığında OTOMATİK geç: yeni SW kontrolü devraldığında
     sayfayı BİR KEZ yenile. Yalnızca sayfa zaten bir SW tarafından kontrol
     ediliyorsa kurulur → ilk ziyarette gereksiz reload olmaz; "refreshing"
     bayrağı reload döngüsünü engeller. Böylece "deploy ettim ama eski sürüm
     görünüyor" sorunu yapısal olarak biter. */
  let refreshing = false;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      /* Güncellemeyi hemen ve sekme yeniden görünür olduğunda kontrol et →
         yeni dağıtım dakikalar içinde yakalanır. */
      reg.update().catch(() => { /* yok say */ });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => { /* yok say */ });
      });
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
