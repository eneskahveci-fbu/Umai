"use client";

import {
  MessageSquare,
  Plus,
  ShieldOff,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Settings,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  FolderGit2,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

export function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const newChat = useStore((s) => s.newChat);
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const incognito = useStore((s) => s.incognito);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const filteredChats = search.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : chats;

  const handleNewChat = () => {
    newChat(false);
    setSidebarOpen(false);
  };

  const handleIncognito = () => {
    newChat(true);
    setSidebarOpen(false);
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleLogout = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      if (sb) await sb.auth.signOut();
    } catch { /* ignore */ }
    setUser(null);
    setSidebarOpen(false);
  };

  // Mobil overlay kapatma
  const handleOverlay = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  if (!sidebarOpen) {
    // Kapalıyken sadece açma butonu
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-20 p-2 rounded-xl bg-surface border border-line text-muted hover:text-ink transition-colors shadow-sm"
        title="Kenar çubuğunu aç"
        aria-label="Kenar çubuğunu aç"
      >
        <PanelLeft size={16} />
      </button>
    );
  }

  return (
    <>
      {/* Mobil overlay */}
      <div className="fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm md:hidden" onClick={handleOverlay} />

      <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-line flex flex-col shadow-lg md:shadow-none">
        {/* Header */}
        <div className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-line">
          <span className="text-sm font-bold tracking-tight">Craft.Coder</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleIncognito}
              className="p-1.5 rounded-lg text-muted hover:text-amber-400 hover:bg-bgsoft transition-colors"
              title="Gizli sohbet"
              aria-label="Gizli sohbet"
            >
              <ShieldOff size={14} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
              title="Kapat"
              aria-label="Kapat"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        </div>

        {/* Yeni sohbet butonu */}
        <div className="p-3 space-y-2 border-b border-line/50">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400 text-black text-sm font-medium hover:bg-amber-300 transition-colors"
          >
            <Plus size={14} />
            Yeni Sohbet
          </button>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sohbet ara..."
              className="w-full bg-bgsoft border border-line/50 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-amber-400/30 transition-colors"
            />
          </div>
        </div>

        {/* Sohbet listesi */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* Gizli sohbet aktifse */}
          {incognito && activeChatId && (
            <button
              onClick={() => setActiveChatId(activeChatId)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20 text-left transition-colors"
            >
              <ShieldOff size={13} className="text-amber-400 shrink-0" />
              <span className="text-xs font-medium truncate text-amber-400">Gizli Sohbet</span>
            </button>
          )}

          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                setActiveChatId(chat.id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors group ${
                chat.id === activeChatId
                  ? "bg-bgsoft border border-line/50"
                  : "hover:bg-bgsoft/50 border border-transparent"
              }`}
            >
              <MessageSquare size={13} className="text-muted/60 shrink-0" />
              <span className="text-xs truncate flex-1">{chat.title || "İsimsiz"}</span>
              <span className="text-[10px] text-muted/40 shrink-0 opacity-0 group-hover:opacity-100">
                {formatDate(chat.updatedAt)}
              </span>
            </button>
          ))}

          {filteredChats.length === 0 && !incognito && (
            <p className="text-xs text-muted/50 text-center py-8">
              {search.trim() ? "Sonuç bulunamadı" : "Henüz sohbet yok"}
            </p>
          )}
        </div>

        {/* Alt profil alanı */}
        <div className="shrink-0 border-t border-line p-2">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-bgsoft transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
                <User size={12} className="text-amber-400" />
              </div>
              <span className="text-xs truncate flex-1 text-left">
                {user?.email ?? "Misafir"}
              </span>
              <ChevronDown
                size={11}
                className={`text-muted transition-transform ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-line rounded-xl shadow-lg overflow-hidden">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        setSettingsOpen(true);
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bgsoft transition-colors"
                    >
                      <Settings size={12} className="text-muted" />
                      Ayarlar
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bgsoft text-red-500 transition-colors"
                    >
                      <LogOut size={12} />
                      Çıkış Yap
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      handleLogin();
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bgsoft transition-colors"
                  >
                    <LogIn size={12} className="text-muted" />
                    Giriş Yap
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Proje göstergesi */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
            <FolderGit2 size={10} className="text-muted/50" />
            <span className="text-[10px] text-muted/50">main</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}d`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
