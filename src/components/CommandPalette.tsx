"use client";

import { useEffect, useState, useCallback } from "react";

interface Command {
  id: string;
  label: string;
  description: string;
  icon?: string;
  action: () => void;
  category?: string;
}

interface Props {
  commands?: Command[];
  open?: boolean;
  onClose?: () => void;
}

const BUILTIN_COMMANDS: Command[] = [
  { id: "new-chat", label: "Yeni Sohbet", description: "Yeni bir sohbet başlat", icon: "+", category: "Sohbet", action: () => document.dispatchEvent(new CustomEvent("new-chat")) },
  { id: "toggle-sidebar", label: "Kenar Çubuğu", description: "Kenar çubuğunu aç/kapat", icon: "☰", category: "Görünüm", action: () => document.dispatchEvent(new CustomEvent("toggle-sidebar")) },
  { id: "settings", label: "Ayarlar", description: "Platform ayarlarını aç", icon: "⚙️", category: "Genel", action: () => document.dispatchEvent(new CustomEvent("open-settings")) },
  { id: "dark-mode", label: "Temayı Değiştir", description: "Koyu/açık tema değiştir", icon: "🌓", category: "Görünüm", action: () => document.dispatchEvent(new CustomEvent("toggle-theme")) },
  { id: "search-files", label: "Dosya Ara", description: "Repo dosyalarında ara", icon: "🔍", category: "Coder", action: () => document.dispatchEvent(new CustomEvent("search-files")) },
  { id: "share", label: "Sohbeti Paylaş", description: "Aktif sohbeti paylaş", icon: "📤", category: "Sohbet", action: () => document.dispatchEvent(new CustomEvent("share-chat")) },
];

export function CommandPalette({ commands: extraCommands, open: controlledOpen, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const allCommands = [...BUILTIN_COMMANDS, ...(extraCommands ?? [])];
  const filtered = allCommands.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      (c.category ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // Ctrl+K ile aç/kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        onClose?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Custom event ile aç
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  const isControlled = controlledOpen !== undefined;
  const visible = isControlled ? controlledOpen : isOpen;

  const close = useCallback(() => {
    if (isControlled) {
      onClose?.();
    } else {
      setIsOpen(false);
    }
    setSearch("");
    setActiveIndex(0);
  }, [isControlled, onClose]);

  const execute = useCallback(
    (cmd: Command) => {
      cmd.action();
      close();
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        execute(filtered[activeIndex]);
      }
    },
    [filtered, activeIndex, execute, close],
  );

  if (!visible) return null;

  const categories = [...new Set(filtered.map((c) => c.category ?? "Diğer"))];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Komut Paleti"
      >
        {/* Arama */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-surface)]">
          <span className="text-[var(--color-ink)]/40">🔍</span>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Komut ara..."
            className="flex-1 bg-transparent outline-none text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-ink)]/40">
            ESC
          </kbd>
        </div>

        {/* Sonuçlar */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-ink)]/40 py-8">
              Sonuç bulunamadı
            </p>
          ) : (
            categories.map((cat) => {
              const cmds = filtered.filter((c) => (c.category ?? "Diğer") === cat);
              if (cmds.length === 0) return null;
              return (
                <div key={cat} className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink)]/30 px-2 py-1">
                    {cat}
                  </div>
                  {cmds.map((cmd) => {
                    const idx = filtered.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          idx === activeIndex
                            ? "bg-[var(--color-brand)]/10 text-[var(--color-ink)]"
                            : "text-[var(--color-ink)]/60 hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <span className="w-5 text-center">{cmd.icon}</span>
                        <div className="flex-1">
                          <div className="text-sm">{cmd.label}</div>
                          <div className="text-[11px] text-[var(--color-ink)]/40">{cmd.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
