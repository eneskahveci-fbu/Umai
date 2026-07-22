"use client";

import { useEffect, useState } from "react";

/* Klavye kısayolu gösterimi için TEK kaynak — Ayarlar/Kısayollar modalındaki
   Mac/Windows tercihini (aynı localStorage anahtarı) okur ki Sidebar,
   Komut Paleti vb. her yerdeki "Ctrl+X" / "⌘X" rozetleri aynı dosya İÇİNDE
   bile birbirinden farklı görünmesin. Tercih değiştiğinde (aynı sekmede)
   anında yansısın diye "storage" event'i (yalnız SEKMELER ARASI çalışır)
   yerine özel bir DOM event'i kullanılıyor. */
export const MAC_MODE_KEY = "craftai_mac_mode";
const MAC_MODE_EVENT = "craftai:mac-mode-changed";

function readMacMode(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem(MAC_MODE_KEY);
  if (saved !== null) return saved === "1";
  return navigator.platform.toUpperCase().includes("MAC");
}

export function setMacMode(next: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAC_MODE_KEY, next ? "1" : "0");
  window.dispatchEvent(new Event(MAC_MODE_EVENT));
}

/** true → Mac (⌘), false → Windows/Linux (Ctrl). */
export function useMacMode(): boolean {
  const [macMode, setLocal] = useState(readMacMode);
  useEffect(() => {
    const sync = () => setLocal(readMacMode());
    sync();
    window.addEventListener(MAC_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MAC_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return macMode;
}

/** Görüntülenecek değiştirici tuş sembolü: "⌘" veya "Ctrl". */
export function useModKey(): "⌘" | "Ctrl" {
  return useMacMode() ? "⌘" : "Ctrl";
}
