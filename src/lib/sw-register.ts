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

/* ─── Web Push abonelik — sekme/tarayıcı KAPALIYKEN de bildirim ───────────
   Tarayıcı bildirimine (Notification, yalnız sekme açıkken) ek; Ayarlar'da
   ayrı bir düğmeden tetiklenir. VAPID public key sunucudan gelir (NEXT_
   PUBLIC_ önekiyle istemciye zaten açık — ayrı bir uç gerekmez). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Push aboneliği başlatır: izin ister, service worker üzerinden abone olur,
    aboneliği sunucuya kaydeder. Başarılıysa true döner. */
export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (!pushSupported() || !vapidPublicKey) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys) return false;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  const data = await res.json().catch(() => ({ ok: false }));
  return !!data.ok;
}

/** Mevcut push aboneliğini hem tarayıcıdan hem sunucudan kaldırır. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } finally {
    await sub.unsubscribe();
  }
}

/** Zaten abone mi? (Ayarlar'da anahtar durumu göstermek için.) */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}
