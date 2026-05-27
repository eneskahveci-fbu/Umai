"use client";

import { useRef, useState } from "react";
import {
  Code2,
  Download,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  VenetianMask,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthButton } from "./AuthButton";

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const exportChat = useStore((s) => s.exportChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const history = chats
    .filter((c) => !c.incognito)
    .filter((c) =>
      search
        ? c.title.toLowerCase().includes(search.toLowerCase())
        : true,
    )
    .sort((a, b) => b.created_at - a.created_at);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      renameChat(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside
      className={`fixed md:static z-40 h-full w-[280px] shrink-0 flex flex-col bg-surface border-r border-line transition-transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Üst: marka + sekmeler */}
      <div className="p-4 border-b border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="w-7 h-7 rounded-lg brand-gradient grid place-items-center text-white text-sm">
              ◆
            </span>
            craft<span className="brand-text">.ai</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-muted p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <TabButton
            active={view === "chat"}
            onClick={() => setView("chat")}
            icon={<MessageSquare size={15} />}
            label="Sohbet"
          />
          <TabButton
            active={view === "coder"}
            onClick={() => setView("coder")}
            icon={<Code2 size={15} />}
            label="Coder"
          />
        </div>
      </div>

      {/* Eylemler */}
      <div className="p-3 flex flex-col gap-2 border-b border-line">
        <button
          onClick={() => newChat(false)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> Yeni Sohbet
        </button>
        <button
          onClick={() => newChat(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-purple/60 text-sm text-muted hover:text-ink transition-colors"
        >
          <VenetianMask size={16} /> Gizli Sohbet
        </button>
      </div>

      {/* Arama + geçmiş */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbet ara..."
            className="w-full bg-bgsoft border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand placeholder:text-muted/60"
          />
        </div>

        <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-2">
          Geçmiş Sohbetler
        </div>
        {history.length === 0 ? (
          <div className="text-center py-8 px-2">
            <MessageSquare
              size={28}
              className="mx-auto mb-2 text-muted/40"
            />
            <p className="text-xs text-muted leading-relaxed">
              {search
                ? "Aramayla eşleşen sohbet yok."
                : "Henüz kayıtlı sohbet yok. \"Yeni Sohbet\" ile başla."}
            </p>
          </div>
        ) : (
          history.map((c) => (
            <div
              key={c.id}
              onClick={() => selectChat(c.id)}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer mb-0.5 text-sm ${
                currentId === c.id ? "bg-bgsoft" : "hover:bg-bgsoft/60"
              }`}
            >
              <MessageSquare
                size={14}
                className="shrink-0 text-muted"
              />
              {editingId === c.id ? (
                <input
                  ref={editRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent border-b border-brand outline-none text-sm min-w-0"
                />
              ) : (
                <span className="flex-1 truncate">{c.title}</span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-70">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(c.id, c.title);
                  }}
                  className="hover:!opacity-100 text-muted hover:text-ink p-0.5"
                  title="Yeniden adlandır"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportChat(c.id);
                  }}
                  className="hover:!opacity-100 text-muted hover:text-ink p-0.5"
                  title="Markdown olarak indir"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  className="hover:!opacity-100 text-muted hover:text-red p-0.5"
                  title="Sil"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alt: ayarlar + giriş + dev */}
      <div className="p-3 border-t border-line flex flex-col gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm"
        >
          <Settings size={15} /> Ayarlar
        </button>
        <AuthButton />
        <DevCredit />
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        active
          ? "bg-brand/12 text-brand border-branddim"
          : "border-line text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function DevCredit() {
  return (
    <div className="text-center text-[11px] text-muted leading-relaxed pt-1">
      Geliştirici ·{" "}
      <span className="text-ink font-semibold">Enes Kahveci</span>
      <br />
      <a
        href="mailto:eneskahveci.bs@gmail.com"
        className="hover:text-brand"
      >
        eneskahveci.bs@gmail.com
      </a>
    </div>
  );
}
