"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";

export type ExportMenuOption = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
};

/* Dışa aktarma dropdown'ı — Tuval'in elle yazdığı "İndir" menüsünü standart
   bir bileşene taşır: tetikleyici buton + tam ekran backdrop + konumlu panel.
   Diğer stüdyoların satır-içi ikon dizisi (Save/Download/Publish yan yana)
   konvansiyonu bundan ayrı kalır — bu yalnız BİRDEN FAZLA export biçimi
   sunan yüzeyler (ör. Tuval'in PNG/HTML/PDF) için. */
export function ExportMenu({
  options,
  disabled,
  busy,
  triggerLabel = "İndir",
  align = "right",
}: {
  options: ExportMenuOption[];
  disabled?: boolean;
  busy?: boolean;
  triggerLabel?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} <span className="hidden sm:inline">{triggerLabel}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-1.5 z-20 w-44 bg-surface border border-line rounded-xl shadow-2xl p-1 text-sm`}>
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => { setOpen(false); o.onSelect(); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"
              >
                {o.icon} {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
