"use client";

import { useStore, type ViewMode } from "@/lib/store";
import { useEffect, useState } from "react";

export function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    view,
    setView,
    sessions,
    activeSessionId,
    setActiveSession,
    addSession,
    removeSession,
    incognitoMode,
    setIncognitoMode,
  } = useStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !sidebarOpen) return null;

  const views: { id: ViewMode; label: string; icon: string }[] = [
    { id: "chat", label: "Sohbet", icon: "💬" },
    { id: "coder", label: "Coder", icon: "🧑‍💻" },
    { id: "compare", label: "Karşılaştırma", icon: "⚖️" },
  ];

  return (
    <aside className="w-64 h-full flex flex-col border-r border-[var(--color-surface)] bg-[var(--color-bg)] shrink-0">
      {/* Görünüm sekmeleri */}
      <div className="flex border-b border-[var(--color-surface)]">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              view === v.id
                ? "text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]"
                : "text-[var(--color-ink)]/50 hover:text-[var(--color-ink)]/70"
            }`}
          >
            <span className="block text-sm mb-0.5">{v.icon}</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Aksiyon butonları */}
      <div className="p-3 flex gap-1">
        <button
          onClick={() => {
            const id = `chat-${Date.now()}`;
            addSession({
              id,
              title: "Yeni Sohbet",
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              incognito: incognitoMode,
            });
            setActiveSession(id);
          }}
          className="flex-1 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-brand)]/10 transition-colors"
          title="Yeni Sohbet"
        >
          + Yeni
        </button>
        <button
          onClick={() => setIncognitoMode(!incognitoMode)}
          className={`px-2 py-1.5 text-xs rounded-lg transition-colors ${
            incognitoMode
              ? "bg-purple-500/20 text-purple-400"
              : "bg-[var(--color-surface)] hover:bg-[var(--color-brand)]/10"
          }`}
          title="Gizli Sohbet"
        >
          🕶️
        </button>
      </div>

      {/* Sohbet geçmişi */}
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <p className="text-center text-xs text-[var(--color-ink)]/40 mt-8">
            Henüz sohbet yok
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSession(s.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-0.5 ${
                activeSessionId === s.id
                  ? "bg-[var(--color-brand)]/10 text-[var(--color-ink)]"
                  : "text-[var(--color-ink)]/60 hover:bg-[var(--color-surface)]"
              }`}
            >
              <span className="truncate flex-1">
                {s.incognito && "🕶️ "}
                {s.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-xs hover:text-red-400 transition-all"
                title="Sil"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Alt bilgi */}
      <div className="p-3 border-t border-[var(--color-surface)] text-xs text-[var(--color-ink)]/40">
        {sessions.length} sohbet • {incognitoMode ? "Gizli mod" : "Normal"}
      </div>
    </aside>
  );
}
