// src/lib/sw-register.ts — Service Worker kaydı

let registration: ServiceWorkerRegistration | null = null;
let connectionCleanup: (() => void) | null = null;

export async function registerSW(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[SW] Kaydedildi:", registration.scope);
  } catch (err) {
    console.warn("[SW] Kayıt başarısız:", err);
  }
}

// Aliases for app/page.tsx compatibility
export const registerServiceWorker = registerSW;

export async function unregisterSW(): Promise<void> {
  if (!registration) return;

  try {
    await registration.unregister();
    registration = null;
  } catch (err) {
    console.warn("[SW] Kaldırma başarısız:", err);
  }
}

// Periyodik güncelleme kontrolü (yalnızca tarayıcıda)
function startPeriodicUpdate(): void {
  if (typeof window === "undefined") return;
  setInterval(async () => {
    if (!registration) return;
    try {
      await registration.update();
    } catch {
      // sessiz
    }
  }, 60 * 60 * 1000);
}

// watchConnection — app/page.tsx tarafından çağrılır
export function watchConnection(): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => console.log("[Bağlantı] Çevrimiçi");
  const onOffline = () => console.log("[Bağlantı] Çevrimdışı");

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  connectionCleanup = () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };

  startPeriodicUpdate();

  return connectionCleanup;
}
