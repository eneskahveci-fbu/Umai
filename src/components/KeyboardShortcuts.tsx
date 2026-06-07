"use client";

import { useEffect, useState } from "react";
import { Command, Keyboard, Monitor, X } from "lucide-react";
import { useStore } from "@/lib/store";

interface Shortcut { keys: string[]; label: string; }

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Genel",
    items: [
      { keys: ["mod", "N"], label: "Yeni oturum" },
      { keys: ["mod", "B"], label: "Yan paneli aç/kapat" },
      { keys: ["mod", "K"], label: "Komut paleti" },
      { keys: ["mod", ","], label: "Ayarlar" },
      { keys: ["mod", "/"], label: "Bu yardım penceresi" },
      { keys: ["?"], label: "Kısayollar (klavyeden)" },
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

const MAC_KEY = "craftai_mac_mode";

export function KeyboardShortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const setOpen = useStore((s) => s.setShortcutsOpen);
  const [macMode, setMacMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem(MAC_KEY);
    if (saved !== null) return saved === "1";
    return navigator.platform.toUpperCase().includes("MAC");
  });

  const toggleMac = () => {
    const next = !macMode;
    setMacMode(next);
    if (typeof window !== "undefined") localStorage.setItem(MAC_KEY, next ? "1" : "0");
  };

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

  const resolveKey = (k: string) => {
    if (k === "mod") return macMode ? "⌘" : "Ctrl";
    return k;
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-bg/75 backdrop-blur-sm grid place-items-center px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 max-h-[88dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center">
              <Keyboard size={14} className="text-brand" />
            </div>
            <h2 className="font-bold text-base">Klavye Kısayolları</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Mac / Windows toggle */}
            <button
              onClick={toggleMac}
              title={macMode ? "Windows moduna geç" : "Mac moduna geç"}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                macMode
                  ? "border-brand/40 bg-brand/8 text-brand"
                  : "border-line text-muted hover:border-brand/30 hover:text-ink"
              }`}
            >
              {macMode ? <Command size={11} /> : <Monitor size={11} />}
              {macMode ? "Mac" : "Win"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>
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
                    className="flex items-center justify-between gap-3 px-2 py-2 sm:py-1.5 rounded-lg hover:bg-bgsoft/50 active:bg-bgsoft transition-colors"
                  >
                    <span className="text-sm text-muted">{sc.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-bgsoft border border-line/80 rounded text-ink/80 min-w-[22px] text-center"
                        >
                          {resolveKey(k)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-line/60 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-muted/50">
            {macMode ? "Mac klavyesi için ⌘ kullanılıyor" : "Windows klavyesi için Ctrl kullanılıyor"}
          </span>
          <button
            onClick={toggleMac}
            className="text-[11px] text-brand/70 hover:text-brand transition-colors"
          >
            {macMode ? "Windows&apos;a geç →" : "Mac&apos;e geç →"}
          </button>
        </div>
      </div>
    </div>
  );
}
