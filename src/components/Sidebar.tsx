"use client";

import { useRef, useState } from "react";
import {
  Code2,
  Download,
  FolderOpen,
  FolderPlus,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  Share2,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthButton } from "./AuthButton";
import { AccordionSection } from "./Accordion";

function SidebarLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#c8a87e" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="14" r="2.8" fill="#c8a87e" fillOpacity="0.9" />
    </svg>
  );
}

export function Sidebar() {
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const config = useStore((s) => s.config);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const exportChat = useStore((s) => s.exportChat);
  const exportChatHtml = useStore((s) => s.exportChatHtml);
  const tagChat = useStore((s) => s.tagChat);
  const pinChat = useStore((s) => s.pinChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const addProject = useStore((s) => s.addProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const removeProject = useStore((s) => s.removeProject);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const addToast = useStore((s) => s.addToast);

  const shareChat = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    setSharingId(chatId);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title: chat.title, messages: chat.messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Paylaşım başarısız");
      const url = `${window.location.origin}/share/${data.shareId}`;
      await navigator.clipboard.writeText(url).catch(() => { /* yok say */ });
      addToast("Link kopyalandı!", "success");
    } catch (e) {
      addToast(`Paylaşım hatası: ${(e as Error).message}`, "error");
    } finally {
      setSharingId(null);
    }
  };

  const activeProject = config.activeProjectId;

  const history = chats
    .filter((c) => !c.incognito)
    .filter((c) => (activeProject ? c.projectId === activeProject : true))
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some((m) =>
        typeof m.content === "string" && m.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.created_at - a.created_at;
    });

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const commitRename = () => {
    if (editingId && editTitle.trim()) renameChat(editingId, editTitle.trim());
    setEditingId(null);
  };

  /* ── Collapsed icon-only ── */
  if (!sidebarOpen) {
    return (
      <aside
        className="fixed top-0 left-0 z-40 h-full w-14 hidden md:flex flex-col bg-surface border-r border-line/60"
        style={{ paddingLeft: "env(safe-area-inset-left)" }}
      >
        <div className="h-14 flex items-center justify-center border-b border-line/60 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Paneli aç (Ctrl+B)"
            className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 grid place-items-center hover:bg-brand/15 transition-colors"
          >
            <SidebarLogo size={20} />
          </button>
        </div>

        <div className="px-2 py-3 border-b border-line/60 shrink-0">
          <button
            onClick={() => newChat(false)}
            title="Yeni oturum (Ctrl+N)"
            className="w-full h-9 rounded-xl bg-brand hover:bg-branddim text-[#111110] grid place-items-center transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 pt-3 overflow-y-auto min-h-0">
          {history.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => selectChat(c.id)}
              title={c.title}
              className={`w-10 h-10 rounded-xl grid place-items-center transition-colors ${
                currentId === c.id
                  ? "bg-brand/15 text-brand"
                  : "text-muted/50 hover:text-ink hover:bg-bgsoft"
              }`}
            >
              <MessageSquare size={14} />
            </button>
          ))}
        </div>

        <div className="px-2 pb-3 space-y-1 shrink-0 border-t border-line/60 pt-3">
          <button
            onClick={() => setSettingsOpen(true)}
            title="Ayarlar (Ctrl+,)"
            className="w-full h-9 rounded-xl border border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink grid place-items-center transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </aside>
    );
  }

  /* ── Expanded ── */
  return (
    <aside
      className="fixed top-0 left-0 z-40 h-full w-[min(80vw,16rem)] md:w-64 flex flex-col bg-surface border-r border-line/60"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-line/60 shrink-0">
        <div className="flex items-center gap-2 font-extrabold text-base tracking-tight">
          <SidebarLogo size={22} />
          <span className="text-ink">Craft</span><span className="brand-text">.Coder</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          title="Kapat (Ctrl+B)"
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* New session */}
      <div className="px-3 py-3 border-b border-line/60 shrink-0">
        <button
          onClick={() => newChat(false)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-branddim text-[#111110] font-semibold text-sm transition-colors"
        >
          <Plus size={15} /> Yeni Oturum
        </button>
      </div>

      {/* Workspace accordion (Projects + History) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <AccordionSection
          id="projects"
          title="Projeler"
          icon={<FolderOpen size={11} />}
          badge={config.projects.length > 0 ? String(config.projects.length) : undefined}
          defaultOpen={!!activeProject}
          action={
            <button
              onClick={(e) => {
                e.stopPropagation();
                const name = window.prompt("Proje adı:");
                if (name?.trim()) addProject(name.trim());
              }}
              title="Yeni proje"
              className="text-muted/50 hover:text-brand p-0.5 transition-colors"
            >
              <FolderPlus size={12} />
            </button>
          }
        >
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
            {config.projects.length === 0 && (
              <span className="text-[11px] text-muted/40 italic py-1">Henüz proje yok</span>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          id="chats"
          title="Sohbetler"
          icon={<MessageSquare size={11} />}
          badge={chats.length > 0 ? String(chats.length) : undefined}
          defaultOpen
        >
          <div className="relative mb-2">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Oturum ara..."
              className="w-full bg-bgsoft/60 border border-line/60 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-brand/50 placeholder:text-muted/35 transition-colors"
            />
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 px-3">
              <Code2 size={20} className="mx-auto mb-2 text-muted/15" />
              <p className="text-[11px] text-muted/40 leading-relaxed">
                {search ? "Eşleşen oturum yok." : "Henüz oturum yok."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {history.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectChat(c.id)}
                  className={`group/item flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-100 ${
                    currentId === c.id
                      ? "bg-brand/8 border border-brand/20 text-ink"
                      : "border border-transparent text-muted hover:text-ink hover:bg-bgsoft/60"
                  }`}
                >
                  <Code2 size={11} className={`shrink-0 ${currentId === c.id ? "text-brand/60" : "opacity-30"}`} />
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
                      className="flex-1 bg-transparent border-b border-brand outline-none text-xs min-w-0"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(c.id, c.title); }}
                      className="flex-1 truncate text-[12px]"
                      title="Çift tıkla yeniden adlandır"
                    >
                      {c.title}
                    </span>
                  )}
                  {c.pinned && <Pin size={9} className="text-brand/60 shrink-0" />}
                  {c.tags && c.tags.length > 0 && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-brand/10 text-brand/70 font-mono shrink-0 max-w-[60px] truncate">
                      {c.tags[0]}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                    <ActionIcon title={c.pinned ? "Sabitlemeyi kaldır" : "Sabitle"} onClick={(e) => { e.stopPropagation(); pinChat(c.id, !c.pinned); }}>
                      <Pin size={10} className={c.pinned ? "text-brand" : ""} />
                    </ActionIcon>
                    <ActionIcon title="Etiket ekle" onClick={(e) => { e.stopPropagation(); const tag = window.prompt("Etiket (virgülle ayır):", c.tags?.join(", ") ?? ""); if (tag !== null) tagChat(c.id, tag.split(",").map(t => t.trim()).filter(Boolean)); }}>
                      <Tag size={10} />
                    </ActionIcon>
                    <ActionIcon title="Yeniden adlandır" onClick={(e) => { e.stopPropagation(); startRename(c.id, c.title); }}>
                      <Pencil size={10} />
                    </ActionIcon>
                    <ActionIcon title={sharingId === c.id ? "Paylaşılıyor…" : "Paylaş (link kopyala)"} onClick={(e) => { e.stopPropagation(); if (!sharingId) shareChat(c.id); }}>
                      <Share2 size={10} />
                    </ActionIcon>
                    <ActionIcon title="İndir" onClick={(e) => { e.stopPropagation(); exportChat(c.id); }}>
                      <Download size={10} />
                    </ActionIcon>
                    <ActionIcon title="Sil" danger onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>
                      <Trash2 size={10} />
                    </ActionIcon>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      </div>

      {/* Bottom */}
      <div className="border-t border-line/60 shrink-0">
        <div className="px-3 pt-3 pb-2 space-y-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line/60 hover:border-brand/40 hover:bg-bgsoft text-sm text-muted hover:text-ink transition-colors"
          >
            <Settings size={14} /> Ayarlar
          </button>
          <AuthButton />
        </div>
        <DevCredit />
      </div>
    </aside>
  );
}

function ActionIcon({
  children, title, danger, onClick,
}: {
  children: React.ReactNode; title: string; danger?: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        danger ? "text-muted/50 hover:text-red" : "text-muted/50 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function DevCredit() {
  return (
    <div className="text-center text-[10px] text-muted/30 leading-relaxed px-3 pb-3">
      <div className="flex justify-center gap-3">
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Gizlilik</a>
        <span>·</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Şartlar</a>
        <span>·</span>
        <a href="/cookies" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Çerezler</a>
      </div>
    </div>
  );
}
