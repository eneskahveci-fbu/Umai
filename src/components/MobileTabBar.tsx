"use client";

/* Mobil alt gezinme çubuğu (yalnız sm altı) — dört öğe: Sohbet · Stüdyo ·
   Araçlar · Ayarlar. Stüdyo'nun 7 modu (Tasarım/Sunum/Doküman/Anket/Tuval/
   Görüntü/Defter) tek tıkla erişilemez değil: içeri girince StudioSwitcher
   (kompakt açılır liste) tümüne ulaştırır. "Araçlar" ve "Ayarlar" birer
   rotaya gitmez — sırasıyla alttan-açılan kısa liste (`MobileToolsSheet`)
   ve mevcut Ayarlar modalını (`setSettingsOpen`) açan aksiyon düğmeleridir.
   Aktif sekme marka renginde; safe-area alt boşluğu korunur. */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Settings, Sparkles, Wrench } from "lucide-react";
import { useStore } from "@/lib/store";
import { MobileToolsSheet } from "./MobileToolsSheet";

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

type Tab =
  | { kind: "link"; href: string; label: string; icon: typeof MessageSquare }
  | { kind: "action"; label: string; icon: typeof MessageSquare; onClick: () => void };

export function MobileTabBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const kbOpen = useKeyboardOpen();
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [toolsOpen, setToolsOpen] = useState(false);

  const TABS: Tab[] = [
    { kind: "link", href: "/app", label: "Sohbet", icon: MessageSquare },
    { kind: "link", href: "/studio", label: "Stüdyo", icon: Sparkles },
    { kind: "action", label: "Araçlar", icon: Wrench, onClick: () => setToolsOpen(true) },
    { kind: "action", label: "Ayarlar", icon: Settings, onClick: () => setSettingsOpen(true) },
  ];

  if (kbOpen) return null;
  return (
    <>
      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-[70] glass border-t border-line flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Alt gezinme"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.kind === "link" && (tab.href === "/studio" ? pathname.startsWith("/studio") : pathname === tab.href);
          return (
            <button
              key={tab.label}
              onClick={() => { if (tab.kind === "link") { if (!active) router.push(tab.href); } else { tab.onClick(); } }}
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
      <MobileToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </>
  );
}
