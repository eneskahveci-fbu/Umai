"use client";

import { useRef, useState } from "react";
import {
  Code2,
  Download,
  FolderOpen,
  FolderPlus,
  GitCompareArrows,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
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
  const config = useStore((s) => s.config);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const exportChat = useStore((s) => s.exportChat);
  const exportChatHtml = useStore((s) => s.exportChatHtml);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const addProject = useStore((s) => s.addProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const removeProject = useStore((s) => s.removeProject);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const activeProject = config.activeProjectId;

  const history = chats
    .filter((c) => !c.incognito)
    .filter((c) => (activeProject ? c.projectId === activeProject : true))
    .filter((c) =>
      search ? c.title.toLowerCase().includes(search.toLowerCase()) : true,
    )
    .sort((a, b) => b.created_at - a.created_at);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const commitRename = () => {
    if (editingId && editTitle.trim()) renameChat(editingId, editTitle.trim());
    setEditingId(null);
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-full w-64 flex flex-col bg-surface border-r border-line/60 transition-transform duration-300 ease-in-out ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Üst: marka + kapat */}
      <div className="px-4 pt-4 pb-3 border-b border-line/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="w-7 h-7 rounded-lg brand-gradient grid place-items-center text-white text-sm shadow-sm shadow-brand/30">
              ◆
            </span>
            craft<span className="brand-text">.ai</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {/* Navigasyon sekmeleri */}
        <div className="grid grid-cols-3 gap-1">
          <TabButton active={view === "chat"} onClick={() => setView("chat")} icon={<MessageSquare size={13} />} label="Sohbet" />
          <TabButton active={view === "coder"} onClick={() => setView("coder")} icon={<Code2 size={13} />} label="Coder" />
          <TabButton active={view === "compare"} onClick={() => setView("compare")} icon={<GitCompareArrows size={13} />} label="Karşılaştır" />
        </div>
      </div>

      {/* Yeni sohbet butonları */}
      <div className="px-3 py-3 border-b border-line/60 space-y-1.5">
        <button
          onClick={() => newChat(false)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm transition-colors"
        >
          <Plus size={15} /> Yeni Sohbet
        </button>
        <button
          onClick={() => newChat(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-line/60 hover:border-line text-sm text-muted hover:text-ink transition-colors"
        >
          <VenetianMask size={14} className="shrink-0" />
          <span>Gizli Sohbet</span>
        </button>
      </div>

      {/* Projeler */}
      {config.projects.length > 0 || true ? (
        <div className="px-3 pt-3 pb-2 border-b border-line/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted/70 px-1">
              Projeler
            </span>
            <button
              onClick={() => {
                const name = window.prompt("Proje adı:");
                if (name?.trim()) addProject(name.trim());
              }}
              className="text-muted hover:text-brand p-0.5 transition-colors"
              title="Yeni proje"
            >
              <FolderPlus size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveProject(null)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                !activeProject
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-line/60 text-muted hover:text-ink hover:border-line"
              }`}
            >
              Tümü
            </button>
            {config.projects.map((p) => (
              <div key={p.id} className="group/proj relative">
                <button
                  onClick={() => setActiveProject(p.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                    activeProject === p.id
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-line/60 text-muted hover:text-ink hover:border-line"
                  }`}
                >
                  <FolderOpen size={10} /> {p.name}
                </button>
                <button
                  onClick={() => { if (confirm(`"${p.name}" projesini sil?`)) removeProject(p.id); }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red text-white grid place-items-center text-[9px] opacity-0 group-hover/proj:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Arama + geçmiş */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbet ara..."
            className="w-full bg-bgsoft/60 border border-line/60 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-brand/50 placeholder:text-muted/40 transition-colors"
          />
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 px-3">
            <MessageSquare size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted/60 leading-relaxed">
              {search ? "Eşleşen sohbet yok." : "Henüz sohbet yok."}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {history.map((c) => (
              <div
                key={c.id}
                onClick={() => selectChat(c.id)}
                className={`group/chat flex items-center gap-2 px-2.5 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-150 ${
                  currentId === c.id
                    ? "bg-bgsoft border border-line/50 text-ink"
                    : "border border-transparent text-muted hover:text-ink hover:bg-bgsoft/60"
                }`}
              >
                <MessageSquare size={13} className="shrink-0 opacity-60" />
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
                  <span className="flex-1 truncate text-[13px]">{c.title}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/chat:opacity-100 transition-opacity shrink-0">
                  <ActionIcon title="Yeniden adlandır" onClick={(e) => { e.stopPropagation(); startRename(c.id, c.title); }}><Pencil size={11} /></ActionIcon>
                  <ActionIcon title="HTML paylaş" onClick={(e) => { e.stopPropagation(); exportChatHtml(c.id); }}><Share2 size={11} /></ActionIcon>
                  <ActionIcon title="İndir" onClick={(e) => { e.stopPropagation(); exportChat(c.id); }}><Download size={11} /></ActionIcon>
                  <ActionIcon title="Sil" danger onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}><Trash2 size={11} /></ActionIcon>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alt */}
      <div className="px-3 py-3 border-t border-line/60 space-y-1.5">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/40 hover:bg-bgsoft text-sm text-muted hover:text-ink transition-colors"
        >
          <Settings size={14} /> Ayarlar
        </button>
        <AuthButton />
        <DevCredit />
      </div>
    </aside>
  );
}

function ActionIcon({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        danger ? "text-muted hover:text-red" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
        active
          ? "bg-brand/10 text-brand border-brand/30"
          : "border-transparent text-muted hover:text-ink hover:bg-bgsoft/60"
      }`}
    >
      {icon} {label}
    </button>
  );
}

export function DevCredit() {
  return (
    <div className="text-center text-[10px] text-muted/50 leading-relaxed pt-1">
      Geliştirici · <span className="text-muted font-medium">Enes Kahveci</span>
      <div className="flex justify-center gap-3 mt-1.5">
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Gizlilik</a>
        <span>·</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Şartlar</a>
        <span>·</span>
        <a href="/cookies" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Çerezler</a>
      </div>
    </div>
  );
}
