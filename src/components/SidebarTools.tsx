"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, FileText, ListChecks, Wrench } from "lucide-react";

/* Sidebar "Araçlar" satırı — kullanıcı anketi (Tem 2026) kararı: içerik
   araçları (Doküman/Anket/Defter) stüdyodan çıkarıldı; burada TEK satır,
   tıklayınca açılan kompakt listeden erişilir. Kendi durumunu kendi tutar
   (Sidebar'ın büyük gövdesine state eklenmez). Dönüştürücü de (Tem 2026)
   buraya eklendi — kendi rotasında (/tools/converter), stüdyo kabuğuna
   girmez. Kütüphane bu listede DEĞİL: Sidebar'da kendi üst-seviye satırı var. */

const TOOLS: { href: string; label: string; desc: string; icon: typeof FileText }[] = [
  { href: "/studio/dokuman", label: "Doküman", desc: "blok tabanlı yazım", icon: FileText },
  { href: "/studio/anket", label: "Anket", desc: "AI anket + HTML form", icon: ListChecks },
  { href: "/studio/defter", label: "Defter", desc: "kaynaklı sohbet + sesli özet", icon: BookOpen },
  /* Dönüştürücü bu listede DEĞİL (kullanıcı onayı): girişi Kütüphane
     başlığındaki buton + ⌘K — aynı araca üç ayrı yol gereksizdi. */
];

export function SidebarTools() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex-1 min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="premium-card w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-ink/80 hover:text-ink hover:border-brand/40 transition-colors"
      >
        <Wrench size={15} className="text-brand shrink-0" /> <span className="truncate">Araçlar</span>
        <ChevronDown size={13} className={`text-muted/60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 pl-1.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.href}
                onClick={() => router.push(t.href)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[13px] text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors"
              >
                <Icon size={13} className="shrink-0 text-brand/70" />
                <span className="font-medium">{t.label}</span>
                <span className="ml-auto text-[10px] text-muted/45 truncate">{t.desc}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
