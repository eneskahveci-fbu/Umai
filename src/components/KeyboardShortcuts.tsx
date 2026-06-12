"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

const shortcuts = [
  { keys: ["⌘", "N"], desc: "Yeni sohbet" },
  { keys: ["⌘", ","], desc: "Ayarlar" },
  { keys: ["⌘", "K"], desc: "Komut paleti" },
  { keys: ["⌘", "B"], desc: "Kenar çubuğu" },
  { keys: ["⌘", "/"], desc: "Kısayollar" },
  { keys: ["⌘", "Enter"], desc: "Gönder" },
  { keys: ["Esc"], desc: "Modal kapat / İptal" },
  { keys: ["↑", "↓"], desc: "Komut paletinde gezinme" },
];

export function KeyboardShortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShortcutsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setShortcutsOpen]);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShortcutsOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Klavye kısayolları"
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-sm font-semibold">Klavye Kısayolları</h2>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors"
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((s) => (
            <div
              key={s.desc}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bgsoft/50"
            >
              <span className="text-sm">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono bg-bgsoft border border-line px-1.5 py-0.5 rounded text-muted min-w-[20px] text-center"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
