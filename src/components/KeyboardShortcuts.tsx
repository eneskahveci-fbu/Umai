"use client";

import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { useStore } from "@/lib/store";

interface Shortcut { keys: string[]; label: string; }

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Genel",
    items: [
      { keys: ["Ctrl", "N"], label: "Yeni oturum" },
      { keys: ["Ctrl", "B"], label: "Yan paneli aç/kapat" },
      { keys: ["Ctrl", "K"], label: "Komut paleti" },
      { keys: ["Ctrl", ","], label: "Ayarlar" },
      { keys: ["Ctrl", "/"], label: "Bu yardım penceresi" },
    ],
  },
  {
    title: "Composer",
    items: [
      { keys: ["Enter"], label: "Mesajı gönder" },
      { keys: ["Shift", "Enter"], label: "Yeni satır" },
      { keys: ["/"], label: "Slash komutları menüsü" },
      { keys: ["@"], label: "Eklenmiş dosyalardan mention" },
    ],
  },
  {
    title: "Subagentlar",
    items: [
      { keys: ["/explain"], label: "Kodu açıkla" },
      { keys: ["/refactor"], label: "Kodu yeniden yaz" },
      { keys: ["/test"], label: "Birim test üret" },
      { keys: ["/fix"], label: "Hatayı düzelt" },
      { keys: ["/review"], label: "Kod incele" },
      { keys: ["/docs"], label: "Dokümantasyon üret" },
    ],
  },
];

export function KeyboardShortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const setOpen = useStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        useStore.getState().setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-bg/75 backdrop-blur-sm grid place-items-center px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center">
              <Keyboard size={14} className="text-brand" />
            </div>
            <h2 className="font-bold text-base">Klavye Kısayolları</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted/60 mb-2">
                {g.title}
              </h3>
              <div className="space-y-1">
                {g.items.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-bgsoft/50 transition-colors"
                  >
                    <span className="text-sm text-muted">{sc.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-bgsoft border border-line/80 rounded text-ink/80 min-w-[22px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-line/60 text-[11px] text-muted/50 text-center shrink-0">
          Mac'te Ctrl yerine ⌘ kullan
        </div>
      </div>
    </div>
  );
}
