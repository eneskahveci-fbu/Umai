"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOffline(!navigator.onLine);
    const off = () => setOffline(true);
    const on = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-semibold backdrop-blur-md shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <WifiOff size={13} />
      Çevrimdışı — AI istekleri başarısız olacak. Konuşma geçmişi açık.
    </div>
  );
}
