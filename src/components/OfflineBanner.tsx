"use client";

// src/components/OfflineBanner.tsx — Çevrimdışı uyarı bandı

import { useState, useEffect } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOffline(!navigator.onLine);

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-600 text-white text-center text-sm py-1.5 font-medium" role="alert">
      ⚡ Çevrimdışısınız — bazı özellikler kullanılamayabilir
    </div>
  );
}
