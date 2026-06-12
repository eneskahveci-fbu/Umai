"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OfflineBanner() {
  /* Track connectivity via useSyncExternalStore — the idiomatic way to read a
     browser API in React, with an SSR-safe snapshot (assume online on server). */
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );

  if (!offline) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-semibold backdrop-blur-md shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[calc(100vw-1.5rem)]"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <WifiOff size={13} />
      <span className="truncate">Çevrimdışı — AI istekleri başarısız olacak.</span>
    </div>
  );
}
