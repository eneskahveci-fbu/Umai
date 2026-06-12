// src/lib/sw-register.ts — Service Worker kaydı

let registration: ServiceWorkerRegistration | null = null;

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

export async function unregisterSW(): Promise<void> {
  if (!registration) return;

  try {
    await registration.unregister();
    registration = null;
  } catch (err) {
    console.warn("[SW] Kaldırma başarısız:", err);
  }
}

// Periyodik güncelleme kontrolü
if (typeof window !== "undefined") {
  setInterval(async () => {
    if (!registration) return;
    try {
      await registration.update();
    } catch {
      // sessiz
    }
  }, 60 * 60 * 1000);
}
