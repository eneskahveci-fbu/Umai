"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { StudioSwitcher } from "./StudioSwitcher";
import type { Surface } from "@/lib/surfaceNav";

/* Stüdyo üst çubuğu — 7 yüzeyin elle kopyaladığı başlık şeridini (mod anahtarı +
   "+ Yeni" + opsiyonel başlık input'u + eylemler + kapat) tek yerde toplar.
   `showWorkActions` false iken yalnız anahtar + kapat görünür (giriş ekranı);
   true iken "+ Yeni"/başlık/eylemler açılır ve kapat butonu otomatik sona
   kayar — üç stüdyonun aynı ml-auto mantığını tekrar yazmaz.
   `icon`/`label` artık görsel olarak basılmıyor (StudioSwitcher'ın kendi
   tetikleyicisi zaten aktif modun ikon+ismini gösteriyor — tekrar olurdu);
   yalnız çubuğun `aria-label`'ı için kullanılıyor, bu yüzden 7 çağıran
   dosyanın hiçbiri değişmedi. */
export function StudioTopBar({
  label,
  activeSurface,
  showWorkActions,
  onNew,
  newLabel = "+ Yeni",
  title,
  actions,
  onClose,
}: {
  icon: LucideIcon;
  label: string;
  activeSurface: Surface;
  showWorkActions: boolean;
  onNew?: () => void;
  newLabel?: string;
  title?: { value: string; onChange: (value: string) => void; placeholder?: string };
  actions?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div aria-label={`${label} başlık çubuğu`} className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
      <StudioSwitcher active={activeSurface} />
      {showWorkActions && (
        <>
          {onNew && (
            <button onClick={onNew} className="text-xs px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink ml-1 shrink-0">
              {newLabel}
            </button>
          )}
          {title && (
            <input
              value={title.value}
              onChange={(e) => title.onChange(e.target.value)}
              placeholder={title.placeholder}
              className="ml-auto hidden md:block w-44 bg-transparent text-xs text-muted focus:text-ink border-b border-transparent focus:border-line outline-none px-1 py-0.5"
            />
          )}
          <div className={`flex items-center gap-1 shrink-0 ${title ? "ml-auto md:ml-1" : "ml-auto"}`}>
            {actions}
          </div>
        </>
      )}
      <button
        onClick={onClose}
        className={`${showWorkActions ? "" : "ml-auto"} w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0`}
        title="Kapat"
      ><X size={16} /></button>
    </div>
  );
}
