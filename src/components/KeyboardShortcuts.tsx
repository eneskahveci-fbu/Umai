"use client";

// src/components/KeyboardShortcuts.tsx — Klavye kısayolları

import { useEffect, type ReactNode } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

interface Props {
  shortcuts: Shortcut[];
  enabled?: boolean;
}

export function KeyboardShortcuts({ shortcuts, enabled = true }: Props) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      // Input/textarea içindeyken çalışma
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      for (const s of shortcuts) {
        const ctrlOk = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftOk = s.shift ? e.shiftKey : !e.shiftKey;
        const altOk = s.alt ? e.altKey : !e.altKey;

        if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlOk && shiftOk && altOk) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);

  return null; // Görünmez bileşen
}

//─────── Genel kısayol listesi ───────
export function getDefaultShortcuts(handlers: {
  newChat: () => void;
  toggleSidebar: () => void;
  focusInput: () => void;
}): Shortcut[] {
  return [
    {
      key: "k",
      ctrl: true,
      handler: handlers.focusInput,
      description: "Komut paletini aç",
    },
    {
      key: "b",
      ctrl: true,
      handler: handlers.toggleSidebar,
      description: "Kenar panelini aç/kapat",
    },
    {
      key: "n",
      ctrl: true,
      handler: handlers.newChat,
      description: "Yeni sohbet",
    },
    {
      key: "Enter",
      ctrl: true,
      handler: handlers.focusInput,
      description: "Sohbet girdisine odaklan",
    },
  ];
}
