"use client";

import { useStore } from "@/lib/store";
import { Command } from "lucide-react";

const shortcuts = [
  { keys: ["⌘", "N"], desc: "Yeni sohbet" },
  { keys: ["⌘", ","], desc: "Ayarlar" },
  { keys: ["⌘", "K"], desc: "Komut paleti" },
  { keys: ["⌘", "B"], desc: "Kenar çubuğu" },
  { keys: ["⌘", "/"], desc: "Kısayollar" },
];

export function KeyboardShortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const setOpen = useStore((s) => s.setShortcutsOpen);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Klavye kısayolları"
    >
      <div
        className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Command size={20} className="text-amber-400" />
          <h3 className="font-semibold text-lg">Klavye Kısayolları</h3>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.desc}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-bgsoft border border-line text-xs font-mono text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted mt-4">
          macOS&apos;ta ⌘ = Cmd, diğer sistemlerde Ctrl
        </p>
      </div>
    </div>
  );
}
