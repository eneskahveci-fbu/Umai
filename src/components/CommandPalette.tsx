"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  VenetianMask,
  Settings,
  Sun,
  Moon,
  BookOpen,
  GitCompareArrows,
  Search,
  Code2,
} from "lucide-react";
import { useStore } from "@/lib/store";

interface PaletteAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const theme = useStore((s) => s.config.theme);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: PaletteAction[] = [
    {
      id: "new-chat",
      label: "Yeni sohbet",
      icon: <MessageSquare size={16} />,
      shortcut: "Ctrl+N",
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
      shortcut: "Ctrl+Shift+N",
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
      shortcut: "Ctrl+,",
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
      id: "compare-mode",
      label: "Karsilastirma modu",
      icon: <GitCompareArrows size={16} />,
      action: () => {
        useStore.getState().setView("compare");
        setOpen(false);
      },
      keywords: ["karsilastir", "compare", "model", "vs"],
    },
    {
      id: "chat-view",
      label: "Sohbet gorunumu",
      icon: <MessageSquare size={16} />,
      action: () => {
        useStore.getState().setView("chat");
        setOpen(false);
      },
      keywords: ["sohbet", "chat", "gorunum"],
    },
    {
      id: "coder-view",
      label: "Coder gorunumu",
      icon: <Code2 size={16} />,
      action: () => {
        useStore.getState().setView("coder");
        setOpen(false);
      },
      keywords: ["coder", "kod", "github", "gorunum"],
    },
  ];

  const filtered = query
    ? actions.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.includes(q))
        );
      })
    : actions;

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

  /* Focus the input after the palette opens (genuine post-render side effect). */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Global Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
        filtered[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
            placeholder="Komut ara..."
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
                onClick={() => a.action()}
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
                <span className="flex-1 text-left">{a.label}</span>
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
