/* Register the service worker once on production builds. Dev mode skipped
   to avoid cache battles with Next.js' HMR. */

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;

  const onLoad = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => { /* registration failures are not user-visible */ });
  };

  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });
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
