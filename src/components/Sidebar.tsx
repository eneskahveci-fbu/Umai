"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Blocks,
  FolderOpen,
  Images,
  Link2,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Chat } from "@/lib/types";
import { chatEmbeddingText, findRelated, withFreshEmbeddings } from "@/lib/relatedItems";
import { AuthButton } from "./AuthButton";
import { AccordionSection } from "./Accordion";

function SidebarLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#5c9478" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="14" r="2.8" fill="#5c9478" fillOpacity="0.9" />
    </svg>
  );
}

/* Sidebar (Tem 2026 kullanıcı kararı — Claude'a paralel bilgi mimarisi):
   Sohbetler VE Projeler artık burada inline LİSTELENMİYOR (arama/etiket/pin/
   vb. tam liste hâlâ yalnız /chats, /projects'te) — ancak kullanıcı isteğiyle
   "Son Sohbetler" (en son 7, her zaman görünür, tıkla-aç) gövdeye geri
   eklendi (bkz. aşağıdaki recentChats). "Eklentiler" butonu artık Ayarlar'ı
   AÇMAZ — ExtensionStoreModal'ı (aynı McpGallery verisini paylaşan hafif bir
   modal) açar. */
export function Sidebar() {
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const updateChatEmbeddings = useStore((s) => s.updateChatEmbeddings);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const extensionStoreOpen = useStore((s) => s.extensionStoreOpen);
  const setExtensionStoreOpen = useStore((s) => s.setExtensionStoreOpen);

  /* Mobilde sidebar tam-ekran overlay olduğundan, yeni sohbet başlatmak onu
     otomatik kapatmalı — aksi halde kullanıcı ayrıca "X"e basmak zorunda
     kalıyordu. Masaüstünde (>=768px, Tailwind md) sidebar sabit bir panel
     olduğundan dokunulmaz. */
  const closeOnMobile = () => { if (window.innerWidth < 768) setSidebarOpen(false); };

  /* "İlgili" (Obsidian-lite) artık proje/kapsam ayrımı yapmadan TÜM (gizli
     olmayan) sohbetler havuzunda arar — Sidebar artık aktif-proje modu
     tutmuyor (bkz. yukarıdaki not). */
  const history = chats.filter((c) => !c.incognito);

  /* Son 7 sohbet (Tem 2026 kullanıcı kararı — geri getirildi): Sidebar
     gövdesinde HER ZAMAN görünen, en son oluşturulan 7 sohbet — "Sohbetler"
     nav'ı hâlâ /chats'e gider (arama/etiket/pin dahil TÜM sohbetler orada). */
  const recentChats = [...history].sort((a, b) => b.created_at - a.created_at).slice(0, 7);

  /* ── Collapsed icon-only ── */
  if (!sidebarOpen) {
    return (
      <aside
        className="fixed top-0 left-0 z-40 h-full w-14 hidden md:flex flex-col bg-surface border-r border-line/60"
        style={{ paddingLeft: "env(safe-area-inset-left)" }}
      >
        <div className="h-14 flex items-center justify-center border-b border-line/60 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Paneli aç (Ctrl+B)"
            className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 grid place-items-center hover:bg-brand/15 transition-colors"
          >
            <SidebarLogo size={20} />
          </button>
        </div>

        <div className="px-2 py-3 border-b border-line/60 shrink-0">
          <button
            onClick={() => newChat(false)}
            title="Yeni oturum (Ctrl+N)"
            className="w-full h-9 rounded-xl bg-brand hover:bg-branddim text-[#111110] grid place-items-center transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Ara (⌘K) — ChatGPT'nin daraltılmış rail'i gibi minimal: logo/yeni/ara
           dışında sohbet listesi tutmaz, tam liste genişletilmiş panelde. */}
        <div className="px-2 pt-2 shrink-0">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            title="Ara (⌘K)"
            className="w-full h-9 rounded-xl text-muted/60 hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
          >
            <Search size={14} />
          </button>
        </div>

        <div className="flex-1" />

        <div className="px-2 pb-3 space-y-1 shrink-0 border-t border-line/60 pt-3">
          <button
            onClick={() => router.push("/studio")}
            title="Stüdyo"
            className={`w-full h-9 rounded-xl border grid place-items-center transition-colors ${
              pathname.startsWith("/studio")
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={() => setExtensionStoreOpen(true)}
            title="Eklenti Mağazası"
            className={`w-full h-9 rounded-xl border grid place-items-center transition-colors ${
              extensionStoreOpen
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <Blocks size={14} />
          </button>
          <button
            onClick={() => router.push("/settings")}
            title="Ayarlar (Ctrl+,)"
            className={`w-full h-9 rounded-xl border grid place-items-center transition-colors ${
              pathname === "/settings"
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <Settings size={14} />
          </button>
        </div>
      </aside>
    );
  }

  /* ── Expanded ── */
  return (
    <aside
      className="fixed top-0 left-0 z-40 h-full w-full md:w-64 flex flex-col bg-surface border-r border-line/60 pb-[max(env(safe-area-inset-bottom),var(--surface-pb,0px))] md:pb-[env(safe-area-inset-bottom)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-line/60 shrink-0">
        <div className="flex items-center gap-2 font-extrabold text-base tracking-tight">
          <SidebarLogo size={22} />
          <span className="text-ink">UMAI</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          title="Kapat (Ctrl+B)"
          className="w-10 h-10 sm:w-7 sm:h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav — Claude'un sol menüsüne paralel: düz simge+metin satırları
         (kart/pill değil), Umai renklerinde. "Yeni sohbet" artık burada değil
         — Claude'daki gibi alttaki ikon düğmeye taşındı (bkz. Bottom).
         Sohbetler ve Projeler artık burada İNLİNE DEĞİL — kendi ayrı
         sayfalarına gider (Tem 2026 kararı): ⌘K arama artık başlık+içerik
         kapsıyor (bkz. CommandPalette.tsx), bu yüzden ayrı bir "sohbetlerde
         ara" kutusuna gerek kalmadı. */}
      <nav className="px-2 py-2 border-b border-line/60 shrink-0 space-y-0.5">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-ink/85 hover:bg-bgsoft/70 hover:text-ink text-sm font-medium transition-colors"
        >
          <Search size={16} className="text-muted/60 shrink-0" />
          <span className="flex-1 text-left">Ara</span>
          <span className="text-[10px] text-muted/40 font-mono shrink-0">⌘K</span>
        </button>
        <button
          onClick={() => { router.push("/chats"); closeOnMobile(); }}
          aria-current={pathname.startsWith("/chats") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/chats") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <MessageSquare size={16} className="shrink-0" />
          <span className="flex-1 text-left">Sohbetler</span>
        </button>
        <button
          onClick={() => router.push("/studio")}
          aria-current={pathname.startsWith("/studio") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/studio") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          <span className="flex-1 text-left">Stüdyo</span>
        </button>
        {/* Kütüphane üst seviyede (Codex IA önerisi): üretilen çıktılar
           keşfedilebilir olsun — Araçlar açılır listesine gömülmesin. */}
        <button
          onClick={() => router.push("/library")}
          aria-current={pathname.startsWith("/library") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/library") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <Images size={16} className="shrink-0" />
          <span className="flex-1 text-left">Kütüphane</span>
        </button>
        <button
          onClick={() => router.push("/projects")}
          aria-current={pathname.startsWith("/projects") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/projects") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <FolderOpen size={16} className="shrink-0" />
          <span className="flex-1 text-left">Projeler</span>
        </button>
        <button
          onClick={() => { setExtensionStoreOpen(true); closeOnMobile(); }}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            extensionStoreOpen ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <Blocks size={16} className="shrink-0" />
          <span className="flex-1 text-left">Eklentiler</span>
        </button>
      </nav>

      {/* "Son Sohbetler" — her zaman görünen, en son 7 sohbet (Tem 2026
          kullanıcı kararı ile geri getirildi). Accordion DEĞİL, sabit liste;
          tüm sohbetler (arama/etiket/pin) hâlâ yalnız /chats'te. */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {recentChats.length > 0 && (
          <div className="px-2 pt-3 pb-1">
            <div className="px-1.5 pb-1.5 text-[11px] font-semibold text-muted/50 uppercase tracking-wide">Son Sohbetler</div>
            <div className="space-y-0.5">
              {recentChats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { selectChat(c.id); closeOnMobile(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    c.id === currentId ? "bg-brand/10 text-brand" : "text-muted hover:text-ink hover:bg-bgsoft/60"
                  }`}
                >
                  <MessageSquare size={12} className="shrink-0 opacity-50" />
                  <span className="flex-1 text-[12.5px] truncate">{c.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {currentId && history.length > 1 && (
          <AccordionSection id="related" title="İlgili" icon={<Link2 size={11} />}>
            <RelatedChats
              chats={history}
              currentId={currentId}
              onOpen={selectChat}
              onEmbeddings={updateChatEmbeddings}
            />
          </AccordionSection>
        )}
      </div>

      {/* Bottom — Claude'un sol alt köşesindeki hesap avatarı + sağ alttaki
         "New chat" ikon düğmesine paralel: iki yuvarlak ikon düğme, aynı
         satırda. Ayarlar butonu burada YOK (bilinçli, kullanıcı kararı):
         Ayarlar hesap menüsünün içinde (AuthButton), tema tercihi Ayarlar →
         Temel'de. Gizlilik/Şartlar/Çerezler linkleri de burada YOK — tek
         kaynak olarak yalnız Ayarlar → Hakkında'da (aynı işleve iki yol
         bırakmamak için). Hızlı erişim: Ctrl+, kısayolu ve ⌘K komutları. */}
      <div className="border-t border-line/60 shrink-0 px-3 py-3 flex items-center justify-between">
        <AuthButton />
        <button
          onClick={() => { newChat(false); closeOnMobile(); }}
          title="Yeni sohbet (Ctrl+N)"
          aria-label="Yeni sohbet"
          className="w-10 h-10 rounded-full bg-brand hover:bg-branddim text-[#111110] grid place-items-center transition-colors shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>
    </aside>
  );
}

/* "İlgili" listesi — mevcut sohbete anlamca en yakın 3-5 sohbeti gösterir
   (rag.ts'in tarayıcı-içi gömme modeli üzerinden, sunucuya veri gitmeden).
   Yalnız AccordionSection açıkken mount olur, böylece gereksiz yere
   çalışmaz. */
function RelatedChats({
  chats, currentId, onOpen, onEmbeddings,
}: {
  chats: Chat[];
  currentId: string;
  onOpen: (id: string) => void;
  onEmbeddings: (updates: { id: string; embedding: number[]; embeddingVersion: number }[]) => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [related, setRelated] = useState<{ item: Chat; score: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      const fresh = await withFreshEmbeddings(chats, (c) => c.messages.length, chatEmbeddingText);
      const changed = fresh
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c !== chats[i]);
      if (changed.length) {
        onEmbeddings(changed.map(({ c }) => ({ id: c.id, embedding: c.embedding!, embeddingVersion: c.embeddingVersion! })));
      }
      if (cancelled) return;
      const target = fresh.find((c) => c.id === currentId);
      if (!target?.embedding?.length) { setState("empty"); return; }
      const hits = findRelated(currentId, target.embedding, fresh, 5).filter((h) => h.score > 0.35);
      setRelated(hits);
      setState(hits.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, currentId]);

  if (state === "loading") {
    return <p className="text-[11px] text-muted/40 px-2 py-1.5">Aranıyor…</p>;
  }
  if (state === "empty") {
    return <p className="text-[11px] text-muted/40 px-2 py-1.5">İlgili sohbet bulunamadı.</p>;
  }
  return (
    <div className="space-y-0.5">
      {related.map(({ item, score }) => (
        <button
          key={item.id}
          onClick={() => onOpen(item.id)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors"
        >
          <Link2 size={11} className="shrink-0 opacity-40" />
          <span className="flex-1 text-[12px] truncate">{item.title}</span>
          <span className="text-[9px] font-mono text-muted/40 shrink-0">{Math.round(score * 100)}%</span>
        </button>
      ))}
    </div>
  );
}
