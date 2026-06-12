"use client";

import { useEffect, useCallback } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

interface Props {
  shortcuts: Shortcut[];
}

export function KeyboardShortcuts({ shortcuts }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Input/textarea alanlarında kısayolları devre dışı bırak (özel tuşlar hariç)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      for (const s of shortcuts) {
        const ctrlOk = s.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const shiftOk = s.shift ? e.shiftKey : !e.shiftKey;
        const altOk = s.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          ctrlOk &&
          shiftOk &&
          altOk
        ) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return null; // Görünmez bileşen, sadece olayları dinler
}

/** Yaygın kullanılan kısayol tanımları */
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    key: "k",
    ctrl: true,
    description: "Komut paletini aç",
    action: () => document.dispatchEvent(new CustomEvent("open-command-palette")),
  },
  {
    key: "b",
    ctrl: true,
    description: "Kenar çubuğunu aç/kapat",
    action: () => document.dispatchEvent(new CustomEvent("toggle-sidebar")),
  },
  {
    key: ",",
    ctrl: true,
    description: "Ayarları aç",
    action: () => document.dispatchEvent(new CustomEvent("open-settings")),
  },
  {
    key: "n",
    ctrl: true,
    description: "Yeni sohbet",
    action: () => document.dispatchEvent(new CustomEvent("new-chat")),
  },
  {
    key: "/",
    ctrl: true,
    description: "Dosya ara",
    action: () => document.dispatchEvent(new CustomEvent("search-files")),
  },
];
