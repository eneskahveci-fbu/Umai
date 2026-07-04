"use client";

/* Mobil alt gezinme çubuğu (yalnız sm altı) — stüdyo rotalarında başparmak
   erişimli yüzey geçişi: Sohbet · Stüdyo · Sunum · Tuval · Görsel. Aktif sekme
   marka renginde; safe-area alt boşluğu korunur. */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Image as ImageIcon, LayoutTemplate, MessageSquare, Presentation, Sparkles } from "lucide-react";

/* Sanal klavye açık mı? (mobil) — visualViewport küçülmesiyle algılanır.
   Alt bar klavye açıkken gizlenir; sayfalar alt boşluğu buna göre sıfırlar. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setOpen(window.innerHeight - vv.height > 150);
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return open;
}

const TABS = [
  { href: "/app", label: "Sohbet", icon: MessageSquare },
  { href: "/studio", label: "Stüdyo", icon: Sparkles },
  { href: "/studio/sunum", label: "Sunum", icon: Presentation },
  { href: "/studio/tuval", label: "Tuval", icon: LayoutTemplate },
  { href: "/studio/gorsel", label: "Görsel", icon: ImageIcon },
];

export function MobileTabBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const kbOpen = useKeyboardOpen();
  if (kbOpen) return null;
  return (
    <nav
      className="sm:hidden fixed inset-x-0 bottom-0 z-[70] glass border-t border-line flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Alt gezinme"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <button
            key={href}
            onClick={() => { if (!active) router.push(href); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              active ? "text-brand" : "text-muted hover:text-ink"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
