"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { ModelConfig, Provider, AppConfig } from "@/lib/types";

interface Props {
  open?: boolean;
  onClose?: () => void;
}

type TabId = "model" | "git" | "general" | "advanced";

export function LibraryModal({ open, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "manual" | "files">("all");

  const isControlled = open !== undefined;
  const visible = isControlled ? open : isOpen;

  const close = useCallback(() => {
    if (isControlled) onClose?.();
    else setIsOpen(false);
  }, [isControlled, onClose]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-library", handler);
    return () => window.removeEventListener("open-library", handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-3xl max-h-[80vh] bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-surface)]">
          <h2 className="text-lg font-semibold">📚 Kütüphane</h2>
          <button onClick={close} className="text-[var(--color-ink)]/40 hover:text-[var(--color-ink)] transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* Arama ve filtreler */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-surface)]">
          <div className="flex-1 flex items-center gap-2 bg-[var(--color-surface)]/50 rounded-lg px-3 py-2">
            <span className="text-[var(--color-ink)]/40">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Skill veya dosya ara..."
              className="flex-1 bg-transparent outline-none text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/40"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="bg-[var(--color-surface)]/50 rounded-lg px-3 py-2 text-xs outline-none border-none text-[var(--color-ink)]/70"
          >
            <option value="all">Tümü</option>
            <option value="manual">Manuel</option>
            <option value="files">Dosyalar</option>
          </select>
        </div>

        {/* İçerik — placeholder */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-sm text-[var(--color-ink)]/40">
              Skill ve referans dosya kütüphanesi burada görüntülenecek.
            </p>
            <p className="text-xs text-[var(--color-ink)]/30 mt-1">
              Skills panelinden skill ekleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
