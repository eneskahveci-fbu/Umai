"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  VenetianMask,
  Settings,
  Sun,
  Moon,
  BookOpen,
  Search,
  FileText,
  Activity,
  Sparkles,
  Image as ImageIcon,
  Images,
  Keyboard,
  Layers,
  ListChecks,
  Network,
  RefreshCw,
  Zap,
  Code2,
  Blocks,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { useModKey } from "@/lib/useModKey";
import { setSurfaceOpenItem } from "@/lib/surfaceNav";
import type { TreeNode } from "@/lib/types";

interface PaletteAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords: string[];
}

/** Birleşik palet satırı: komut VEYA dosya. */
interface Row {
  id: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

function flattenTree(node: TreeNode | null): { name: string; path: string }[] {
  if (!node) return [];
  return [...node.files, ...Object.values(node.dirs).flatMap(flattenTree)];
}

export function CommandPalette() {
  const mod = useModKey();
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const theme = useStore((s) => s.config.theme);
  const tree = useStore((s) => s.tree);
  const chats = useStore((s) => s.chats);
  const config = useStore((s) => s.config);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const actions: PaletteAction[] = [
    {
      id: "new-chat",
      label: "Yeni sohbet",
      icon: <MessageSquare size={16} />,
      shortcut: `${mod}+N`,
      action: () => {
        useStore.getState().newChat(false);
        setOpen(false);
      },
      keywords: ["yeni", "sohbet", "chat", "new"],
    },
    {
      id: "incognito-chat",
      label: "Gizli sohbet",
      icon: <VenetianMask size={16} />,
      shortcut: `${mod}+Shift+N`,
      action: () => {
        useStore.getState().newChat(true);
        setOpen(false);
      },
      keywords: ["gizli", "sohbet", "incognito", "private"],
    },
    {
      id: "settings",
      label: "Ayarlar",
      icon: <Settings size={16} />,
      shortcut: `${mod}+,`,
      action: () => {
        useStore.getState().setSettingsOpen(true);
        setOpen(false);
      },
      keywords: ["ayarlar", "settings", "yapilandirma", "config"],
    },
    {
      id: "toggle-theme",
      label: theme === "dark" ? "Acik temaya gec" : "Koyu temaya gec",
      icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      action: () => {
        useStore.getState().toggleTheme();
        setOpen(false);
      },
      keywords: ["tema", "theme", "dark", "light", "koyu", "acik", "degistir"],
    },
    {
      id: "open-studio",
      label: "Stüdyo'yu aç (brief → AI tasarım)",
      icon: <Sparkles size={16} />,
      action: () => {
        router.push("/studio");
        setOpen(false);
      },
      keywords: ["studyo", "stüdyo", "studio", "tasarim", "design", "web", "tuval", "sablon", "şablon", "sosyal"],
    },
    {
      id: "open-docs",
      label: "Doküman Stüdyosu'nu aç (blok tabanlı)",
      icon: <FileText size={16} />,
      action: () => {
        router.push("/studio/dokuman");
        setOpen(false);
      },
      keywords: ["dokuman", "doküman", "docs", "not", "notion", "yazi", "yazı", "markdown"],
    },
    {
      id: "open-forms",
      label: "Anket Stüdyosu'nu aç (AI anket + HTML form)",
      icon: <ListChecks size={16} />,
      action: () => {
        router.push("/studio/araclar?tab=anket");
        setOpen(false);
      },
      keywords: ["anket", "form", "survey", "soru", "geri bildirim", "feedback"],
    },
    {
      id: "open-notebook",
      label: "Defter'i aç (kaynaklı sohbet + sesli özet)",
      icon: <BookOpen size={16} />,
      action: () => {
        router.push("/studio/araclar?tab=defter");
        setOpen(false);
      },
      keywords: ["defter", "notebook", "kaynak", "arastirma", "araştırma", "notebooklm", "ozet", "özet"],
    },
    {
      id: "open-map",
      label: "Kroki'yi aç (AI zihin haritası)",
      icon: <Network size={16} />,
      action: () => {
        router.push("/studio/araclar?tab=kroki");
        setOpen(false);
      },
      keywords: ["kroki", "harita", "zihin", "mindmap", "mind map", "beyin", "firtinasi", "fırtınası", "dal"],
    },
    {
      id: "open-cards",
      label: "Kartlar'ı aç (AI kartlarla aralıklı tekrar)",
      icon: <Layers size={16} />,
      action: () => {
        router.push("/studio/araclar?tab=kartlar");
        setOpen(false);
      },
      keywords: ["kart", "kartlar", "anki", "flashcard", "ezber", "tekrar", "vurgu", "vurgular", "calis", "çalış"],
    },
    {
      id: "open-image",
      label: "Görsel oluştur (sohbette /gorsel)",
      icon: <ImageIcon size={16} />,
      action: () => {
        /* İki yol birden: zaten /app'teysek canlı custom event anında yakalanır;
           başka bir rotadan geliniyorsa router.push sonrası CoderView henüz
           mount olmamıştır — sessionStorage handoff (surfaceNav.ts'teki
           setSurfaceHandoff ile aynı desen) mount olunca okunur, zamanlama
           sorunu olmaz. */
        try { sessionStorage.setItem("craft_composer_prefill", "/gorsel "); } catch { /* yok say */ }
        window.dispatchEvent(new CustomEvent("craftai:composer-prefill", { detail: { text: "/gorsel " } }));
        router.push("/app");
        setOpen(false);
      },
      keywords: ["goruntu", "görüntü", "image", "gorsel", "görsel", "resim"],
    },
    {
      id: "open-library",
      label: "Kütüphane'yi aç (tüm çıktılar tek yerde)",
      icon: <Images size={16} />,
      action: () => {
        router.push("/library");
        setOpen(false);
      },
      keywords: ["kutuphane", "kütüphane", "library", "medya", "media", "galeri", "gallery", "arsiv", "arşiv"],
    },
    {
      id: "open-converter",
      label: "Dönüştürücü'yü aç (görsel ⇄ PDF/PNG/JPG/WebP)",
      icon: <RefreshCw size={16} />,
      action: () => {
        router.push("/tools/converter");
        setOpen(false);
      },
      keywords: ["donusturucu", "dönüştürücü", "converter", "pdf", "png", "jpg", "webp", "donustur", "dönüştür"],
    },
    {
      id: "open-skills",
      label: "Skills (eğitim seti)",
      icon: <Zap size={16} />,
      action: () => {
        useStore.getState().setSkillsOpen(true);
        setOpen(false);
      },
      keywords: ["skills", "skill", "egitim", "eğitim", "kural", "agent"],
    },
    {
      id: "open-editor",
      label: "Editör (IDE)",
      icon: <Code2 size={16} />,
      action: () => {
        useStore.getState().setEditorOpen(true);
        setOpen(false);
      },
      keywords: ["editor", "editör", "ide", "kod", "dosya"],
    },
    {
      id: "activity-log",
      label: "Etkinlik günlüğü",
      icon: <Activity size={16} />,
      action: () => {
        useStore.getState().setActivityOpen(true);
        setOpen(false);
      },
      keywords: ["etkinlik", "gunluk", "activity", "log", "denetim", "audit", "gecmis"],
    },
    {
      id: "prompt-library",
      label: "Kütüphane (şablonlar)",
      icon: <BookOpen size={16} />,
      action: () => {
        useStore.getState().setLibraryTab("prompts");
        useStore.getState().setLibraryOpen(true);
        setOpen(false);
      },
      keywords: ["prompt", "kutuphane", "library", "sablon", "template", "snippet"],
    },
    {
      id: "extension-store",
      label: "Eklenti Mağazası",
      icon: <Blocks size={16} />,
      action: () => {
        useStore.getState().setExtensionStoreOpen(true);
        setOpen(false);
      },
      keywords: ["eklenti", "extension", "mcp", "uygulama", "bağlantı", "connector", "store", "magaza"],
    },
    {
      id: "keyboard-shortcuts",
      label: "Kısayollar",
      icon: <Keyboard size={16} />,
      action: () => {
        useStore.getState().setShortcutsOpen(true);
        setOpen(false);
      },
      keywords: ["kisayol", "shortcut", "klavye", "keyboard"],
    },
  ];

  const commandRows: Row[] = (query
    ? actions.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.includes(q))
        );
      })
    : actions
  ).map((a) => ({ id: a.id, label: a.label, icon: a.icon, shortcut: a.shortcut, run: a.action }));

  /* Cmd+P tarzı dosya bulucu: en az 1 karakter yazınca repo ağacında ara,
     seçilince dosyayı editörde aç (CoderView dinler). */
  const q = query.toLowerCase();
  const fileRows: Row[] = query.length >= 1
    ? flattenTree(tree)
        .filter((f) => f.path.toLowerCase().includes(q))
        .slice(0, 8)
        .map((f) => ({
          id: "file:" + f.path,
          label: f.name,
          sub: f.path,
          icon: <FileText size={16} />,
          run: () => {
            window.dispatchEvent(new CustomEvent("craftai:open-file", { detail: { path: f.path } }));
            setOpen(false);
          },
        }))
    : [];

  /* Birleşik arama: sohbetler (başlık + içerik — Sidebar'ın kaldırılan inline
     "Sohbetlerde ara" kutusuyla AYNI kapsam, Tem 2026 kararı: tek arama
     kaynağı burası) + Doküman/Anket/Defter kayıtları — yalnız dosya
     bulucuyla aynı eşikte (en az 1 karakter), her tür en fazla 5 sonuç. */
  const chatRows: Row[] = query.length >= 1
    ? chats
        .filter((c) => !c.incognito && (
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => typeof m.content === "string" && m.content.toLowerCase().includes(q))
        ))
        .slice(0, 5)
        .map((c) => ({
          id: "chat:" + c.id,
          label: c.title || "Adsız sohbet",
          sub: "Sohbet",
          icon: <MessageSquare size={16} />,
          run: () => { useStore.getState().selectChat(c.id); setOpen(false); },
        }))
    : [];

  const docRows: Row[] = query.length >= 1
    ? (config.craftDocs ?? [])
        .filter((d) => d.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((d) => ({
          id: "doc:" + d.id,
          label: d.title,
          sub: "Doküman",
          icon: <FileText size={16} />,
          run: () => { setSurfaceOpenItem("docs", d.id); router.push("/studio/dokuman"); setOpen(false); },
        }))
    : [];

  const formRows: Row[] = query.length >= 1
    ? (config.craftForms ?? [])
        .filter((f) => f.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((f) => ({
          id: "form:" + f.id,
          label: f.title,
          sub: "Anket",
          icon: <ListChecks size={16} />,
          run: () => { setSurfaceOpenItem("forms", f.id); router.push("/studio/araclar?tab=anket"); setOpen(false); },
        }))
    : [];

  const notebookRows: Row[] = query.length >= 1
    ? (config.craftNotebooks ?? [])
        .filter((n) => n.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((n) => ({
          id: "notebook:" + n.id,
          label: n.title,
          sub: "Defter",
          icon: <BookOpen size={16} />,
          run: () => { setSurfaceOpenItem("notebook", n.id); router.push("/studio/araclar?tab=defter"); setOpen(false); },
        }))
    : [];

  const mapRows: Row[] = query.length >= 1
    ? (config.craftMaps ?? [])
        .filter((m) => m.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((m) => ({
          id: "map:" + m.id,
          label: m.title,
          sub: "Kroki",
          icon: <Network size={16} />,
          run: () => { setSurfaceOpenItem("map", m.id); router.push("/studio/araclar?tab=kroki"); setOpen(false); },
        }))
    : [];

  const deckRows: Row[] = query.length >= 1
    ? (config.craftDecks ?? [])
        .filter((d) => d.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((d) => ({
          id: "deck:" + d.id,
          label: d.title,
          sub: "Kartlar",
          icon: <Layers size={16} />,
          run: () => { setSurfaceOpenItem("cards", d.id); router.push("/studio/araclar?tab=kartlar"); setOpen(false); },
        }))
    : [];

  const filtered: Row[] = [...commandRows, ...chatRows, ...docRows, ...formRows, ...notebookRows, ...mapRows, ...deckRows, ...fileRows];

  /* Reset the highlighted row when the query changes, and clear search when
     the palette (re)opens — both adjusted during render rather than in an
     effect (React's recommended pattern for prop-derived state). */
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  /* Focus-trap + Escape-ile-kapama + odak-dönüşü — SettingsModal/SkillsPanel
     ile aynı a11y deseni. İlk odaklanan eleman zaten arama input'u olduğundan
     ayrı bir manuel focus efekti gerekmiyor. */
  useModalA11y(modalRef, open, () => setOpen(false));

  // Global Ctrl+K listener — bu paletin AÇMA/KAPAMA kısayolunun TEK kaynağı
  // (app/page.tsx'in genel kısayol dinleyicisi kasıtlı olarak "k"yı ele almaz).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      /* Ctrl/Cmd+K → komut paleti, Ctrl/Cmd+P → hızlı dosya bulucu (ikisi de
         aynı paleti açar; dosya araması yazdıkça çalışır). */
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "p")) {
        e.preventDefault();
        setOpen(!useStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
      }
    }
    /* Escape artık useModalA11y tarafından (document seviyesinde) ele alınıyor. */
  };

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        className="w-full max-w-lg mx-4 bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Komut veya dosya ara…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
          <kbd className="text-[10px] text-muted border border-line rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Actions list */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Sonuc bulunamadi.
            </div>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.id}
                onClick={() => a.run()}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-brand/10 text-brand"
                    : "text-ink hover:bg-bgsoft"
                }`}
              >
                <span
                  className={
                    i === selectedIndex ? "text-brand" : "text-muted"
                  }
                >
                  {a.icon}
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block truncate">{a.label}</span>
                  {a.sub && <span className="block truncate text-[11px] text-muted/60 font-mono">{a.sub}</span>}
                </span>
                {a.shortcut && (
                  <kbd className="text-[10px] text-muted border border-line rounded px-1.5 py-0.5 font-mono">
                    {a.shortcut}
                  </kbd>
                )}
                {i === selectedIndex && !a.shortcut && (
                  <kbd className="text-[10px] text-muted border border-line rounded px-1.5 py-0.5 font-mono">
                    Enter
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
