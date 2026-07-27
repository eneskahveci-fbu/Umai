"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/* X4 — kromsuz tam ekran sunum katmanı.

   Tasarım stüdyosuna eklenen sunum modunun (bkz. ArtifactCanvas) yüzey-bağımsız
   hâli: içeriği çağıran verir, bu bileşen yalnız tam ekran kabuğu + çıkışı
   yönetir. Diğer yüzeylerde "büyüt" bile yoktu; bir krokiyi/dokümanı göstermek
   için uygulama kromu (sekmeler, araç çubuğu, kaynak paneli) hep ekrandaydı.

   Çıkış düğmesi yalnız fare üzerine gelince belirir — sunum sırasında ekranda
   hiçbir krom durmasın. Escape her zaman çalışır. */
export function PresentOverlay({
  open,
  onClose,
  children,
  label = "Sunum",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    /* Arkadaki sayfa kaydırmasın — tam ekran sunumda gövde kaydırması
       kullanıcıyı içerikten koparıyordu. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-bg overflow-auto" role="dialog" aria-modal="true" aria-label={label}>
      {children}
      <button
        onClick={onClose}
        title="Sunumdan çık (Esc)"
        aria-label="Sunumdan çık"
        className="fixed top-3 right-3 w-9 h-9 rounded-full bg-black/45 text-white/80 backdrop-blur-sm grid place-items-center opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        <X size={17} />
      </button>
    </div>
  );
}
