"use client";

import { useEffect, useState } from "react";
import { watchConnection } from "@/lib/sw-register";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    return watchConnection(setOnline);
  }, []);

  if (online) return null;

  return (
    <div
      className="sticky top-0 z-50 bg-amber-500/90 text-black text-center py-2 text-sm font-medium backdrop-blur-sm"
      role="alert"
    >
      ⚠️ İnternet bağlantısı kesildi — bazı özellikler kullanılamayabilir
    </div>
  );
}
