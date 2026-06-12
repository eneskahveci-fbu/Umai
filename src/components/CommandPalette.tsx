"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Search, Plus, Settings, Globe, FileText, MessageSquare } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: "sohbet" | "görünüm" | "ayarlar" | "diğer";
}

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const newChat = useStore((s) => s.newChat);
  const setActiveChat = useStore((s) => s.setActiveChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const chats = useStore((s) => s.chats);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands: CommandItem[] = [
    {
      id: "new-chat",
      label: "Yeni Sohbet",
      icon: <Plus size={16} />,
      action: () => {
        newChat(false);
        setOpen(false);
      },
      category: "sohbet",
    },
    {
      id: "new-incognito",
      label: "Gizli Sohbet",
      icon: <MessageSquare size={16} />,
      action: () => {
        newChat(true);
        setOpen(false);
      },
      category: "sohbet",
    },
    {
      id: "settings",
      label: "Ayarları Aç",
      icon: <Settings size={16} />,
      action: () => {
        setSettingsOpen(true);
        setOpen(false);
      },
      category: "ayarlar",
    },
    {
      id: "web-search",
      label: "Web Arama",
      icon: <Globe size={16} />,
      action: () => setOpen(false),
      category: "diğer",
    },
  ];

  // Sohbetleri de komut listesine ekle
  const chatCommands: CommandItem[] = chats
    .filter((c) => !c.incognito)
    .slice(0, 10)
    .map((c) => ({
      id: `chat-${c.id}`,
      label: c.title,
      icon: <FileText size={16} />,
      action: () => {
        setActiveChat(c.id);
        setOpen(false);
      },
      category: "sohbet" as const,
    }));

  const allCommands = [...commands, ...chatCommands];

  const filtered = query.trim()
    ? allCommands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()),
      )
    : allCommands;

  const safeIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  const execute = (item: CommandItem) => {
    item.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[safeIdx]) {
      e.preventDefault();
      execute(filtered[safeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-bg/80 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Komut paleti"
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Komut ara..."
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted"
          />
          <kbd className="px-1.5 py-0.5 rounded-md bg-bgsoft border border-line text-[10px] text-muted font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">
              Sonuç bulunamadı
            </p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => execute(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                  idx === safeIdx
                    ? "bg-amber-400/15 text-amber-400"
                    : "text-ink hover:bg-bgsoft"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                <span className="ml-auto text-[10px] text-muted uppercase">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
