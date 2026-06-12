"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOffline(!navigator.onLine);

    const on = () => setOffline(false);
    const off = () => setOffline(true);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-sm">
      <WifiOff size={14} />
      <span>Çevrimdışısınız. Bazı özellikler çalışmayabilir.</span>
    </div>
  );
}
