"use client";

/* Mobil "Araçlar" alt-sekmesinin açtığı kısa liste — masaüstündeki
   `SidebarTools.tsx` açılır listesinin mobil eşleniği (aynı araçlar).
   Görüntü burada YOK: üretimi genel sohbette "/gorsel" komutuyla yapılıyor,
   ayrı bir stüdyo yüzeyi yok. Kendi durumunu `MobileTabBar` tutar, bu yalnız
   görünümdür. */
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Images, ListChecks, Network, X } from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";

const TOOLS: { href: string; label: string; desc: string; icon: typeof FileText }[] = [
  { href: "/library", label: "Kütüphane", desc: "tüm çıktıların tek yeri", icon: Images },
  { href: "/studio/dokuman", label: "Doküman", desc: "blok tabanlı yazım", icon: FileText },
  { href: "/studio/anket", label: "Anket", desc: "AI anket + HTML form", icon: ListChecks },
  { href: "/studio/defter", label: "Defter", desc: "kaynaklı sohbet + sesli özet", icon: BookOpen },
  { href: "/studio/kroki", label: "Kroki", desc: "AI zihin haritası + SVG", icon: Network },
  /* Dönüştürücü bu listede DEĞİL (masaüstüyle tutarlı): girişi Kütüphane
     başlığındaki buton — mobilde de Kütüphane buradan bir dokunuş uzakta. */
];

export function MobileToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, open, onClose);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className="sm:hidden fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-modal-bg"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Araçlar"
    >
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-3 animate-modal-content"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-bold">Araçlar</h2>
          <button onClick={onClose} aria-label="Kapat" className="w-10 h-10 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={16} /></button>
        </div>
        <div className="space-y-0.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.href}
                onClick={() => { onClose(); router.push(t.href); }}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left hover:bg-bgsoft/60 transition-colors"
              >
                <span className="w-9 h-9 rounded-lg grid place-items-center bg-brand/10 text-brand shrink-0"><Icon size={16} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{t.label}</span>
                  <span className="block text-[11px] text-muted/60 truncate">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
