/* PWA service worker'ını kaydeder (public/sw.js — network-first, bayat-bundle
   güvenli). Kurulabilir uygulama + çevrimdışı yedek sağlar; gezinmede daima
   ağdan taze HTML çekildiği için eski "bayat paket" sorunu geri gelmez. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  /* Yeni sürüm dağıtıldığında OTOMATİK geç: yeni SW kontrolü devraldığında
     sayfayı BİR KEZ yenile. Yalnızca sayfa zaten bir SW tarafından kontrol
     ediliyorsa kurulur → ilk ziyarette gereksiz reload olmaz.
     `refreshing` bayrağı TEK bir sayfa yüklemesi içinde ikinci bir reload'u
     engeller ama reload'un KENDİSİ sayfayı sıfırdan çalıştırdığından bu
     bayrak da sıfırlanır — art arda birden fazla controllerchange (ör. kısa
     sürede birkaç dağıtımın üst üste yakalanması) reload'ları ARASINDA
     hayatta kalan bir sessionStorage damgasıyla ek olarak sınırlanır, bu
     yüzden hiçbir koşulda "saniyede bir yenilenme" döngüsü oluşamaz. */
  const RELOAD_GUARD_KEY = "craftai_sw_reload_at";
  const RELOAD_COOLDOWN_MS = 10_000;
  let refreshing = false;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch { /* sessionStorage erişilemezse eski davranışa düş */ }
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
