/**
 * Service Worker kaydı ve bağlantı durumu takibi.
 */

let connectionWatcher: (() => void) | null = null;

/**
 * Service Worker'ı kaydeder. Başarısız olursa sessizce geçer.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Kayıt başarılı:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Kayıt başarısız:", err);
      });
  });
}

/**
 * Çevrimiçi/çevrimdışı durumunu izler. Durum değişince callback'i çağırır.
 * Geri dönen cleanup fonksiyonunu useEffect'te kullan.
 */
export function watchConnection(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") {
    callback(true);
    return () => {};
  }

  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);

  // İlk durumu bildir
  callback(navigator.onLine);

  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
