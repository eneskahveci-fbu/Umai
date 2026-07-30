import { useStore } from "./store";
import { runAfterStreaming } from "./streamGate";

/** Her derlemede DEĞİŞEN sürüm damgası. `/sw.js?v=<BUILD_ID>` olarak
    kaydedilir ve service worker bunu KENDİ URL'inden okuyup önbellek adı
    yapar (bkz. public/sw.js). Böylece yeni dağıtımda `activate` eski
    önbellekleri gerçekten siler.

    Neden şart: önceden `sw.js` içindeki sürüm sabit bir literaldi
    ("craft-v3"). Önbellek adları hiç değişmediği için `activate`'teki temizlik
    HİÇBİR ŞEY silmiyordu; `/_next/static/*` cache-first olduğundan GEÇMİŞ TÜM
    derlemelerin chunk'ları önbellekte kalıyordu. Tek bir başarısız gezinme
    isteği (zayıf bağlantı, dağıtım anındaki 5xx) network-first'ün catch
    dalını tetikleyip önbellekteki DAĞITIM ÖNCESİ HTML'i sunuyor, o HTML eski
    chunk hash'lerini istiyor, o chunk'lar da hâlâ önbellekte olduğu için
    ÖNCEKİ DERLEME bütünüyle ve sorunsuz açılıyordu — kullanıcının
    "sanki eski commit'e geri dönüyor" dediği şey tam olarak buydu. */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

/** Yeni sürüm hazır olduğunda kullanıcıya SORAN bildirim. Sayfayı kendiliğinden
    ASLA yenilemez.

    Önceden yeni SW devralınca sayfa (akış bitiminde ya da 120 sn'lik güvenlik
    ağı dolunca) otomatik yenileniyordu. Kullanıcı açısından bu "tarayıcı
    kendini yeniden başlattı" demekti ve yenileme `persistCurrent()` çözülmeden
    gerçekleşirse biten yanıt da kayboluyordu. Artık karar kullanıcınındır;
    tıklarsa ÖNCE kayıt tamamlanır, SONRA yenilenir. */
function promptForUpdate(): void {
  runAfterStreaming({
    isStreaming: () => useStore.getState().streaming,
    subscribe: (cb) => useStore.subscribe(cb),
    /* Akış sürerken bildirimi göstermeyi ertelemek yalnız gürültü içindir;
       takılı kalan bir `streaming` bayrağı yüzünden hiç görünmemesin diye
       güvenlik ağı bırakıldı — bu yol artık yalnız BİLDİRİM gösteriyor,
       yıkıcı bir şey yapmıyor. */
    safetyMs: 120_000,
    run: () => {
      useStore.getState().addToast("Yeni sürüm hazır.", "info", {
        /* Uzun ömürlü: kullanıcı uygun bir anda tıklasın. Kaçırırsa da sorun
           değil — sürüm damgası düzeltmesinden sonra bayat kabuk sunulamıyor,
           bir sonraki normal yenilemede yeni sürüm zaten gelir. */
        duration: 600_000,
        action: {
          label: "Yenile",
          fn: () => {
            /* Kaydetme YARIDA KESİLMESİN: reload persistCurrent() çözüldükten
               sonra. Aksi halde yeniden yüklemede loadChats buluttaki ESKİ
               kopyayı çekiyor ve biten yanıt kayboluyordu. */
            void useStore.getState().persistCurrent()
              .catch(() => { /* kayıt başarısız olsa da kullanıcı yenilemek istedi */ })
              .then(() => window.location.reload());
          },
        },
      });
    },
  });
}

/* PWA service worker'ını kaydeder (public/sw.js — network-first, bayat-bundle
   güvenli). Kurulabilir uygulama + çevrimdışı yedek sağlar; gezinmede daima
   ağdan taze HTML çekildiği için eski "bayat paket" sorunu geri gelmez. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  /* Yeni sürüm dağıtıldığında kullanıcıya SOR — sayfayı kendiliğinden yenileme.
     Yalnızca sayfa zaten bir SW tarafından kontrol ediliyorsa kurulur → ilk
     ziyarette gereksiz bildirim çıkmaz. `prompted` bayrağı art arda gelen
     controllerchange olaylarında bildirimin tekrarlanmasını engeller. */
  let prompted = false;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (prompted) return;
      prompted = true;
      promptForUpdate();
    });
  }

  const register = async () => {
    try {
      /* `?v=` sürüm damgası: hem tarayıcıyı yeni script'i almaya zorlar hem de
         SW'nin önbellek adlarını derlemeye özel yapmasını sağlar (bkz. BUILD_ID). */
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`, { scope: "/" });
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
