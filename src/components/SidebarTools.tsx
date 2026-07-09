"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, FileText, ListChecks, Wrench } from "lucide-react";

/* Sidebar "Araçlar" satırı — kullanıcı anketi (Tem 2026) kararı: içerik
   araçları (Doküman/Anket/Defter) stüdyodan çıkarıldı; burada TEK satır,
   tıklayınca açılan kompakt listeden erişilir. Kendi durumunu kendi tutar
   (Sidebar'ın büyük gövdesine state eklenmez). */

const TOOLS: { href: string; label: string; desc: string; icon: typeof FileText }[] = [
  { href: "/studio/dokuman", label: "Doküman", desc: "blok tabanlı yazım", icon: FileText },
  { href: "/studio/anket", label: "Anket", desc: "AI anket + HTML form", icon: ListChecks },
  { href: "/studio/defter", label: "Defter", desc: "kaynaklı sohbet + sesli özet", icon: BookOpen },
];

export function SidebarTools() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group premium-card w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-ink/80 hover:text-ink hover:border-brand/40 transition-all"
      >
        <Wrench size={15} className="text-brand transition-transform duration-200 group-hover:scale-110" /> Araçlar
        <ChevronDown size={13} className={`ml-auto text-muted/60 transition-transform ${open ? "rotate-180" : ""}`} />
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
