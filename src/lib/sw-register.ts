"use client";

let reg: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((r) => {
      reg = r;
    })
    .catch(() => {
      // SW kaydı başarısız olursa sessizce geç
    });
}

export function watchConnection(): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => {
    document.documentElement.classList.toggle("offline", !navigator.onLine);
  };

  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  // Başlangıç durumu
  handler();

  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
