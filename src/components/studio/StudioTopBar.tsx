"use client";

import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
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
  onBack,
  backLabel = "Galeri",
  title,
  actions,
  onClose,
}: {
  label: string;
  activeSurface: Surface;
  showWorkActions: boolean;
  onNew?: () => void;
  newLabel?: string;
  /** U2 — çalışmayı KAYBETMEDEN giriş ekranına dön. Verilmezse hiç
      render edilmez (giriş ekranında zaten dönülecek bir yer yok). */
  onBack?: () => void;
  backLabel?: string;
  title?: { value: string; onChange: (value: string) => void; placeholder?: string };
  actions?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div aria-label={`${label} başlık çubuğu`} className="h-12 shrink-0 flex items-center gap-2 px-3 sm:px-4 border-b border-line">
      <StudioSwitcher active={activeSurface} />
      {/* U1 — Kimlik. StudioSwitcher tek yüzey kaldığından null döndürüyor
         (bkz. StudioSwitcher.tsx); bu yüzden çubuğun SOL tarafı tamamen boş
         kalıyordu: yeni bir kullanıcı 48px'lik bir şeritte yalnız bir "X"
         görüyordu. Yüzeyin adı artık her zaman burada. */}
      {onBack ? (
        <button
          onClick={onBack}
          title={`${backLabel} — çalışman kaydedilir`}
          className="flex items-center gap-1.5 shrink-0 -ml-1 pl-1.5 pr-2.5 py-2 sm:py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
        >
          <ArrowLeft size={15} />
          <span className="text-xs font-semibold">{backLabel}</span>
        </button>
      ) : (
        <span className="shrink-0 text-sm font-semibold text-ink">{label}</span>
      )}
      {showWorkActions && (
        <>
          {onNew && (
            <button onClick={onNew} className="text-xs px-2.5 py-2 sm:py-1 rounded-lg border border-line text-muted hover:text-ink hover:bg-bgsoft ml-1 shrink-0 transition-colors">
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
          <div className={`flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar ${title ? "ml-auto md:ml-1" : "ml-auto"}`}>
            {actions}
          </div>
        </>
      )}
      <button
        onClick={onClose}
        className={`${showWorkActions ? "" : "ml-auto"} w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors shrink-0`}
        title="Kapat"
        aria-label="Kapat"
      ><X size={16} /></button>
    </div>
  );
}
