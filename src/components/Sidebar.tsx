"use client";

import { useStore } from "@/lib/store";
import {
  MessageSquare,
  Plus,
  EyeOff,
  PanelLeftClose,
  Trash2,
  Pin,
  Settings,
  FolderGit2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const setActiveChat = useStore((s) => s.setActiveChat);
  const newChat = useStore((s) => s.newChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const updateChat = useStore((s) => s.updateChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setLibraryOpen = useStore((s) => s.setLibraryOpen);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);

  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const visibleChats = chats.filter((c) => !c.incognito);
  const pinned = visibleChats.filter((c) => c.pinned);
  const unpinned = visibleChats.filter((c) => !c.pinned);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("tr-TR", { weekday: "short" });
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <>
      {/* Mobil overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-surface border-r border-line flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight">Craft.Coder</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => newChat(true)}
              className="hover:bg-bgsoft rounded-lg p-1.5 transition-colors"
              title="Gizli sohbet"
              aria-label="Gizli sohbet"
            >
              <EyeOff size={16} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="hover:bg-bgsoft rounded-lg p-1.5 transition-colors md:hidden"
              title="Kapat"
              aria-label="Kenar çubuğunu kapat"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        {/* New chat button */}
        <div className="px-3 py-2">
          <button
            onClick={() => {
              newChat(false);
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors"
          >
            <Plus size={16} />
            Yeni Sohbet
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {/* Projeler */}
          {projects.length > 0 && (
            <>
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-ink transition-colors"
              >
                {projectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <FolderGit2 size={12} />
                Projeler
              </button>
              {projectsExpanded &&
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p.id === activeProjectId ? null : p.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                      activeProjectId === p.id
                        ? "bg-amber-400/10 text-amber-400"
                        : "text-muted hover:bg-bgsoft hover:text-ink"
                    }`}
                  >
                    <FolderGit2 size={14} className="shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              <div className="border-t border-line my-2 mx-2" />
            </>
          )}

          {/* Sabitlenmiş */}
          {pinned.map((c) => (
            <ChatRow
              key={c.id}
              chat={c}
              active={c.id === activeChatId}
              onClick={() => {
                setActiveChat(c.id);
                setSidebarOpen(false);
              }}
              onDelete={() => deleteChat(c.id)}
              onTogglePin={() => updateChat(c.id, { pinned: !c.pinned })}
              formatTime={formatTime}
            />
          ))}

          {pinned.length > 0 && unpinned.length > 0 && (
            <div className="border-t border-line my-1 mx-2" />
          )}

          {/* Normal sohbetler */}
          {unpinned.map((c) => (
            <ChatRow
              key={c.id}
              chat={c}
              active={c.id === activeChatId}
              onClick={() => {
                setActiveChat(c.id);
                setSidebarOpen(false);
              }}
              onDelete={() => deleteChat(c.id)}
              onTogglePin={() => updateChat(c.id, { pinned: !c.pinned })}
              formatTime={formatTime}
            />
          ))}

          {visibleChats.length === 0 && (
            <p className="text-xs text-muted text-center py-6">
              Henüz sohbet yok. Yeni bir sohbet başlatın.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-line flex gap-1">
          <button
            onClick={() => setLibraryOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-muted hover:bg-bgsoft hover:text-ink transition-colors"
            title="Projeler"
          >
            <FolderGit2 size={14} />
            Projeler
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-muted hover:bg-bgsoft hover:text-ink transition-colors"
            title="Ayarlar"
          >
            <Settings size={14} />
            Ayarlar
          </button>
        </div>
      </aside>
    </>
  );
}

function ChatRow({
  chat,
  active,
  onClick,
  onDelete,
  onTogglePin,
  formatTime,
}: {
  chat: { id: string; title: string; pinned?: boolean; updatedAt: number };
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  formatTime: (ts: number) => string;
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        active ? "bg-amber-400/10" : "hover:bg-bgsoft"
      }`}
      onClick={onClick}
    >
      <MessageSquare
        size={14}
        className={`shrink-0 ${active ? "text-amber-400" : "text-muted"}`}
      />
      <span
        className={`flex-1 truncate text-sm ${active ? "text-amber-400 font-medium" : "text-ink"}`}
      >
        {chat.title}
      </span>
      <span className="text-[10px] text-muted shrink-0">{formatTime(chat.updatedAt)}</span>

      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`p-0.5 rounded transition-colors ${
            chat.pinned ? "text-amber-400" : "text-muted hover:text-ink"
          }`}
          title={chat.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
        >
          <Pin size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 rounded text-muted hover:text-red-400 transition-colors"
          title="Sil"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
