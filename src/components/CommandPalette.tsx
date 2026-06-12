"use client";

import { Search, Command, Hash, Settings, FileText, MessageSquare, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "@/lib/store";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  group: string;
  action: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const chats = useStore((s) => s.chats);
  const newChat = useStore((s) => s.newChat);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);
  const setOnboardingOpen = useStore((s) => s.setOnboardingOpen);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: "new-chat", label: "Yeni Sohbet", description: "Boş bir sohbet başlat", icon: MessageSquare, group: "Eylemler", action: () => { newChat(); setCommandPaletteOpen(false); } },
      { id: "settings", label: "Ayarlar", description: "Model, tema ve diğer ayarlar", icon: Settings, group: "Eylemler", action: () => { setSettingsOpen(true); setCommandPaletteOpen(false); } },
      { id: "shortcuts", label: "Kısayollar", description: "Klavye kısayollarını gör", icon: Command, group: "Eylemler", action: () => { setShortcutsOpen(true); setCommandPaletteOpen(false); } },
      { id: "library", label: "Dosya Kütüphanesi", description: "Referans dosyaları yönet", icon: FileText, group: "Eylemler", action: () => { setLibraryOpen(true); setCommandPaletteOpen(false); } },
      { id: "onboarding", label: "Turu Başlat", description: "Platform turunu tekrar izle", icon: Hash, group: "Eylemler", action: () => { setOnboardingOpen(true); setCommandPaletteOpen(false); } },
      ...chats.slice(0, 20).map((c) => ({
        id: c.id,
        label: c.title || "İsimsiz Sohbet",
        description: `${c.messages.length} mesaj`,
        icon: MessageSquare,
        group: "Sohbetler",
        action: () => { setActiveChatId(c.id); setCommandPaletteOpen(false); },
      })),
    ],
    [chats, newChat, setCommandPaletteOpen, setSettingsOpen, setShortcutsOpen, setLibraryOpen, setOnboardingOpen, setActiveChatId]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((c) => {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    });
    return [...map.entries()];
  }, [filtered]);

  // Flatten for keyboard navigation
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev + 1) % Math.max(1, flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[selectedIdx]?.action();
    } else if (e.key === "Escape") {
      setCommandPaletteOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCommandPaletteOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Komut paleti"
    >
      <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search size={15} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Komut veya sohbet ara..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
          <kbd className="text-[10px] font-mono bg-bgsoft border border-line px-1.5 py-0.5 rounded text-muted">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/50 px-3 py-1.5">
                {group}
              </div>
              {items.map((item) => {
                const idx = flat.indexOf(item);
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={item.id}
                    ref={isSelected ? selectedRef : undefined}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
                      isSelected ? "bg-amber-400/10 text-amber-400" : "hover:bg-bgsoft text-ink"
                    }`}
                  >
                    <item.icon size={15} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.description && (
                      <span className="text-[11px] text-muted truncate max-w-[40%]">
                        {item.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <p className="text-sm text-muted text-center py-8">Sonuç bulunamadı</p>
          )}
        </div>
      </div>
    </div>
  );
}
