"use client";

// src/components/ChatHistory.tsx — Kenar çubuğundaki sohbet geçmişi listesi (Sidebar içinde ChatRow ile birlikte kullanılır)
// Bu bileşen Sidebar'da referans edilen ChatRow'un tam halini sağlar.

import {
  MessageSquare,
  Pin,
  Trash2,
} from "lucide-react";
import type { ChatMessage } from "@/lib/types";

// Sidebar'da kullanılan sohbet kartı
export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  incognito: boolean;
  createdAt: number;
  lastMessage?: string;
}

interface ChatRowProps {
  chat: ChatSummary;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  formatTime: (ts: number) => string;
}

export function ChatRow({
  chat,
  active,
  onClick,
  onDelete,
  onTogglePin,
  formatTime,
}: ChatRowProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-left ${
        active
          ? "bg-amber-400/10 text-amber-400"
          : "text-muted hover:bg-bgsoft hover:text-ink"
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {chat.incognito ? (
        <MessageSquare size={14} className="shrink-0 opacity-60" />
      ) : (
        <MessageSquare size={14} className="shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{chat.title || "Yeni Sohbet"}</p>
        {chat.lastMessage && (
          <p className="text-xs truncate opacity-60">{chat.lastMessage}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`p-0.5 rounded hover:bg-surface transition-colors ${
            chat.pinned ? "text-amber-400" : ""
          }`}
          title={chat.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
          aria-label={chat.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
        >
          <Pin size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 rounded hover:bg-surface hover:text-red-400 transition-colors"
          title="Sil"
          aria-label="Sohbeti sil"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <span className="text-[10px] opacity-50 shrink-0">
        {formatTime(chat.createdAt)}
      </span>
    </div>
  );
}

// Sohbet başlığı oluşturma yardımcısı
export function generateChatTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "Yeni Sohbet";
  const text = firstUserMsg.content.trim();
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
}
