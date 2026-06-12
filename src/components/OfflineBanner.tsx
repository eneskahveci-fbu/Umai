"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const go = () => setOffline(!navigator.onLine);
    window.addEventListener("online", go);
    window.addEventListener("offline", go);
    go();
    return () => {
      window.removeEventListener("online", go);
      window.removeEventListener("offline", go);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-400 text-black text-xs font-medium py-1.5 px-4">
      <WifiOff size={12} />
      <span>İnternet bağlantısı kesildi — değişiklikler yerel olarak saklanıyor</span>
    </div>
  );
}
