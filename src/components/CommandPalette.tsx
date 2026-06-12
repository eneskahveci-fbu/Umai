"use client";

// src/components/CommandPalette.tsx — ⌘K komut paleti (hızlı erişim)

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  Settings,
  BookOpen,
  GitBranch,
  Code2,
  Columns2,
  User,
  Moon,
  Sun,
  ArrowRight,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const config = useStore((s) => s.config);
  const updateConfig = useStore((s) => s.updateConfig);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const newChat = useStore((s) => s.newChat);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    {
      id: "new-chat",
      label: "Yeni Sohbet",
      description: "Yeni bir sohbet başlat",
      icon: <MessageSquare size={16} />,
      action: () => { newChat(false); setOpen(false); },
    },
    {
      id: "new-incognito",
      label: "Gizli Sohbet",
      description: "Geçmişe kaydedilmeyen sohbet",
      icon: <MessageSquare size={16} className="opacity-50" />,
      action: () => { newChat(true); setOpen(false); },
    },
    {
      id: "settings",
      label: "Ayarlar",
      description: "Model, Git, tema ayarları",
      icon: <Settings size={16} />,
      action: () => { setSettingsOpen(true); setOpen(false); },
    },
    {
      id: "coder",
      label: "Coder Görünümü",
      description: "Kod editörü ve terminal",
      icon: <Code2 size={16} />,
      action: () => { router.push("/app?view=coder"); setOpen(false); },
    },
    {
      id: "compare",
      label: "Karşılaştırma Görünümü",
      description: "Farklı model yanıtlarını karşılaştır",
      icon: <Columns2 size={16} />,
      action: () => { router.push("/app?view=compare"); setOpen(false); },
    },
    {
      id: "theme",
      label: "Tema Değiştir",
      description: `Koyu ↔ Açık (şu an: ${config.theme})`,
      icon: config.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />,
      action: () => { updateConfig("theme", config.theme === "dark" ? "light" : "dark"); },
    },
    {
      id: "docs",
      label: "Dokümantasyon",
      description: "Kullanım kılavuzunu aç",
      icon: <BookOpen size={16} />,
      action: () => { window.open("/docs", "_blank"); setOpen(false); },
    },
    {
      id: "login",
      label: "Giriş Yap",
      description: "Hesabınla oturum aç",
      icon: <User size={16} />,
      action: () => { router.push("/login"); setOpen(false); },
    },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selectedIdx]?.action();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [filtered, selectedIdx, setOpen],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[22vh] bg-bg/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal
      aria-label="Komut paleti"
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Arama çubuğu */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Komut ara..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-muted"
            aria-label="Komut ara"
          />
          <kbd className="text-[10px] text-muted bg-bgsoft px-1.5 py-0.5 rounded border border-line">
            ESC
          </kbd>
        </div>

        {/* Komut listesi */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">Komut bulunamadı</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => cmd.action()}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  i === selectedIdx
                    ? "bg-amber-400/10 text-amber-400"
                    : "text-ink hover:bg-bgsoft"
                }`}
              >
                <span className="shrink-0">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{cmd.label}</p>
                  <p className="text-xs text-muted">{cmd.description}</p>
                </div>
                {i === selectedIdx && <ArrowRight size={14} className="shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
