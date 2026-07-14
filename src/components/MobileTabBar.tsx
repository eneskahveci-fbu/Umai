"use client";

/* Mobil alt gezinme çubuğu (yalnız sm altı) — üç öğe: Sohbet · Stüdyo ·
   Ayarlar. Stüdyo artık tek mod (Tasarım) — Görüntü üretimi genel sohbette
   "/gorsel" komutuna taşındı. İçerik araçları (Doküman/Anket/Defter/Kroki/
   Kartlar) eskiden ayrı bir "Araçlar" sekmesi (alttan-sheet) idi; artık
   Stüdyo ana ekranındaki (StudioHomeScreen) büyük araç kartlarından
   erişiliyor — ayrı bir gezinme yolu tutmak yerine tek giriş noktası.
   "Ayarlar" gerçek `/settings` rotasına gider (Sidebar'ın masaüstündeki
   düğmesiyle aynı hizada), böylece diğer sekmelerle aynı aktif-vurgu
   deseni otomatik çalışır. Aktif sekme marka renginde; safe-area alt
   boşluğu korunur. */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Settings, Sparkles } from "lucide-react";

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

interface Tab { href: string; label: string; icon: typeof MessageSquare }

const TABS: Tab[] = [
  { href: "/app", label: "Sohbet", icon: MessageSquare },
  { href: "/studio", label: "Stüdyo", icon: Sparkles },
  { href: "/settings", label: "Ayarlar", icon: Settings },
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
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.href === "/studio" ? pathname.startsWith("/studio") : pathname === tab.href;
        return (
          <button
            key={tab.label}
            onClick={() => { if (!active) router.push(tab.href); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              active ? "text-brand" : "text-muted hover:text-ink"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
