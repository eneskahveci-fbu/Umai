"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Images,
  Layers,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  Settings2,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PROJECT_TEMPLATES, projectColorHex } from "@/lib/constants";
import type { Chat } from "@/lib/types";
import { chatEmbeddingText, findRelated, withFreshEmbeddings } from "@/lib/relatedItems";
import { AuthButton } from "./AuthButton";
import { AccordionSection } from "./Accordion";

/* Sohbetleri tarih kovalarına böler (Claude Code tarzı): Bugün, Dün, Son 7 gün… */
function groupChatsByDate(items: Chat[]): { label: string; items: Chat[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  const buckets: { label: string; items: Chat[] }[] = [
    { label: "Bugün", items: [] },
    { label: "Dün", items: [] },
    { label: "Son 7 gün", items: [] },
    { label: "Son 30 gün", items: [] },
    { label: "Daha eski", items: [] },
  ];
  for (const c of items) {
    const t = c.created_at;
    if (t >= startOfToday) buckets[0].items.push(c);
    else if (t >= startOfToday - dayMs) buckets[1].items.push(c);
    else if (t >= startOfToday - 7 * dayMs) buckets[2].items.push(c);
    else if (t >= startOfToday - 30 * dayMs) buckets[3].items.push(c);
    else buckets[4].items.push(c);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function SidebarLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14 4L23 9.5V18.5L14 24L5 18.5V9.5L14 4Z" stroke="#5c9478" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="14" r="2.8" fill="#5c9478" fillOpacity="0.9" />
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
  const copyChatMarkdown = useStore((s) => s.copyChatMarkdown);
  const tagChat = useStore((s) => s.tagChat);
  const pinChat = useStore((s) => s.pinChat);
  const moveChat = useStore((s) => s.moveChat);
  const updateChatEmbeddings = useStore((s) => s.updateChatEmbeddings);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const addProject = useStore((s) => s.addProject);
  const addProjectFromTemplate = useStore((s) => s.addProjectFromTemplate);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const removeProject = useStore((s) => s.removeProject);
  const updateProject = useStore((s) => s.updateProject);
  const setProjectModalId = useStore((s) => s.setProjectModalId);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);

  const [search, setSearch] = useState("");
  /* Proje: satır-içi ekleme/yeniden adlandırma (window.prompt yerine). */
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const addToast = useStore((s) => s.addToast);

  /* "⋯" taşma menüsü — dışarı tıklayınca / Escape ile kapanır. */
  useEffect(() => {
    if (!overflowMenuId) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chat-menu]")) setOverflowMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverflowMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowMenuId]);

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

  /* Proje başına sohbet sayısı (gizli hariç) — profesyonel rozet için. */
  const projectCounts = new Map<string, number>();
  for (const c of chats) {
    if (c.incognito || !c.projectId) continue;
    projectCounts.set(c.projectId, (projectCounts.get(c.projectId) ?? 0) + 1);
  }
  const unassignedCount = chats.filter((c) => !c.incognito && !c.projectId).length;

  const submitNewProject = () => {
    const name = newProjectName.trim();
    if (name) addProject(name);
    setNewProjectName("");
    setAddingProject(false);
  };
  const submitRenameProject = () => {
    const name = editProjectName.trim();
    if (editingProjectId && name) updateProject(editingProjectId, { name });
    setEditingProjectId(null);
    setEditProjectName("");
  };

  const matchesSearch = (c: Chat) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (c.title.toLowerCase().includes(q)) return true;
    return c.messages.some((m) => typeof m.content === "string" && m.content.toLowerCase().includes(q));
  };
  const sortChats = (list: Chat[]) => [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.created_at - a.created_at;
  });
  const toSections = (list: Chat[]): { label: string; items: Chat[] }[] => {
    const pinned = list.filter((c) => c.pinned);
    const unpinned = list.filter((c) => !c.pinned);
    return [
      ...(pinned.length ? [{ label: "Sabitlenenler", items: pinned }] : []),
      ...groupChatsByDate(unpinned),
    ];
  };

  /* ChatGPT'nin Projects'i gibi: proje seçiliyken o projenin sohbetleri
     KENDİ satırının altında iç içe (nested) gösterilir — aşağıdaki "Sohbetler"
     bölümü her zaman yalnız PROJESİZ sohbetleri listeler (filtrelenip
     gizlenmez), böylece iki liste birbirini ezmez. */
  const unassignedHistory = sortChats(chats.filter((c) => !c.incognito && !c.projectId && matchesSearch(c)));
  const activeProjectHistory = activeProject
    ? sortChats(chats.filter((c) => !c.incognito && c.projectId === activeProject && matchesSearch(c)))
    : [];
  const history = activeProject ? activeProjectHistory : unassignedHistory;

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const commitRename = () => {
    if (editingId && editTitle.trim()) renameChat(editingId, editTitle.trim());
    setEditingId(null);
  };

  const sections = toSections(unassignedHistory);
  const activeProjectSections = toSections(activeProjectHistory);

  /* Mobilde sidebar tam-ekran overlay olduğundan, bir sohbet seçmek/başlatmak
     onu otomatik kapatmalı — aksi halde kullanıcı ayrıca "X"e basmak zorunda
     kalıyordu. Masaüstünde (>=768px, Tailwind md) sidebar sabit bir panel
     olduğundan dokunulmaz. */
  const closeOnMobile = () => { if (window.innerWidth < 768) setSidebarOpen(false); };

  const renderRow = (c: Chat) => (
    <div
      key={c.id}
      onClick={() => { selectChat(c.id); closeOnMobile(); }}
      className={`group/item flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-100 ${
        currentId === c.id
          ? "bg-brand/10 border border-brand/25 border-l-2 border-l-brand shadow-sm text-ink"
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
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Hızlı sabitle/sil — yalnız hover özellikli cihazlarda (masaüstü);
            dokunmatikte satır başına ikon kalabalığı olmasın diye "..." menüsü
            içinden erişilir (aşağıda, mobil-erişilebilir). */}
        <div className="hidden sm:flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 transition-opacity">
          <ActionIcon title={c.pinned ? "Sabitlemeyi kaldır" : "Sabitle"} onClick={(e) => { e.stopPropagation(); pinChat(c.id, !c.pinned); }}>
            <Pin size={10} className={c.pinned ? "text-brand" : ""} />
          </ActionIcon>
        </div>
        <div className="relative" data-chat-menu>
          <ActionIcon title="Daha fazla" onClick={(e) => { e.stopPropagation(); setOverflowMenuId(overflowMenuId === c.id ? null : c.id); }}>
            <MoreHorizontal size={10} />
          </ActionIcon>
          {overflowMenuId === c.id && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-in absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-line bg-surface elev-2 py-1 text-[12px]"
            >
              <button
                onClick={() => { setOverflowMenuId(null); pinChat(c.id, !c.pinned); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left sm:hidden"
              >
                <Pin size={12} className={c.pinned ? "text-brand" : ""} /> {c.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
              </button>
              {config.projects.length > 0 && (
                <div className="relative flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 cursor-pointer">
                  <FolderInput size={12} className={`shrink-0 ${c.projectId ? "text-brand" : ""}`} />
                  <span className="flex-1 truncate">Projeye taşı</span>
                  <select
                    aria-label="Projeye taşı"
                    value={c.projectId ?? ""}
                    onChange={(e) => { moveChat(c.id, e.target.value || null); setOverflowMenuId(null); }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value="">Projesiz</option>
                    {config.projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => { setOverflowMenuId(null); const tag = window.prompt("Etiket (virgülle ayır):", c.tags?.join(", ") ?? ""); if (tag !== null) tagChat(c.id, tag.split(",").map(t => t.trim()).filter(Boolean)); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left"
              >
                <Tag size={12} /> Etiket ekle
              </button>
              <button
                onClick={() => { setOverflowMenuId(null); if (!sharingId) shareChat(c.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left"
              >
                <Share2 size={12} /> {sharingId === c.id ? "Paylaşılıyor…" : "Paylaş"}
              </button>
              <button
                onClick={() => { setOverflowMenuId(null); exportChat(c.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left"
              >
                <Download size={12} /> İndir (Markdown)
              </button>
              <button
                onClick={() => { setOverflowMenuId(null); void copyChatMarkdown(c.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left"
              >
                <Copy size={12} /> Kopyala (Markdown)
              </button>
              <div className="h-px bg-line/60 my-1 sm:hidden" />
              <button
                onClick={() => { setOverflowMenuId(null); if (confirm(`"${c.title || "Bu sohbet"}" silinsin mi? Bu işlem geri alınamaz.`)) deleteChat(c.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left text-red-400 sm:hidden"
              >
                <Trash2 size={12} /> Sil
              </button>
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 transition-opacity">
          <ActionIcon title="Sil" danger onClick={(e) => { e.stopPropagation(); if (confirm(`"${c.title || "Bu sohbet"}" silinsin mi? Bu işlem geri alınamaz.`)) deleteChat(c.id); }}>
            <Trash2 size={10} />
          </ActionIcon>
        </div>
      </div>
    </div>
  );

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

        {/* Ara (⌘K) — ChatGPT'nin daraltılmış rail'i gibi minimal: logo/yeni/ara
           dışında sohbet listesi tutmaz, tam liste genişletilmiş panelde. */}
        <div className="px-2 pt-2 shrink-0">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            title="Ara (⌘K)"
            className="w-full h-9 rounded-xl text-muted/60 hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
          >
            <Search size={14} />
          </button>
        </div>

        <div className="flex-1" />

        <div className="px-2 pb-3 space-y-1 shrink-0 border-t border-line/60 pt-3">
          <button
            onClick={() => router.push("/studio")}
            title="Stüdyo"
            className={`w-full h-9 rounded-xl border grid place-items-center transition-colors ${
              pathname.startsWith("/studio")
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink"
            }`}
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={() => router.push("/settings")}
            title="Ayarlar (Ctrl+,)"
            className={`w-full h-9 rounded-xl border grid place-items-center transition-colors ${
              pathname === "/settings"
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line/60 hover:border-brand/40 hover:bg-bgsoft text-muted hover:text-ink"
            }`}
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
      className="fixed top-0 left-0 z-40 h-full w-full md:w-64 flex flex-col bg-surface border-r border-line/60 pb-[max(env(safe-area-inset-bottom),var(--surface-pb,0px))] md:pb-[env(safe-area-inset-bottom)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-line/60 shrink-0">
        <div className="flex items-center gap-2 font-extrabold text-base tracking-tight">
          <SidebarLogo size={22} />
          <span className="text-ink">UMAI</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          title="Kapat (Ctrl+B)"
          className="w-10 h-10 sm:w-7 sm:h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav — Claude'un sol menüsüne paralel: düz simge+metin satırları
         (kart/pill değil), Umai renklerinde. "Yeni sohbet" artık burada değil
         — Claude'daki gibi alttaki ikon düğmeye taşındı (bkz. Bottom). */}
      <nav className="px-2 py-2 border-b border-line/60 shrink-0 space-y-0.5">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-ink/85 hover:bg-bgsoft/70 hover:text-ink text-sm font-medium transition-colors"
        >
          <Search size={16} className="text-muted/60 shrink-0" />
          <span className="flex-1 text-left">Ara</span>
          <span className="text-[10px] text-muted/40 font-mono shrink-0">⌘K</span>
        </button>
        <button
          onClick={() => router.push("/studio")}
          aria-current={pathname.startsWith("/studio") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/studio") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          <span className="flex-1 text-left">Stüdyo</span>
        </button>
        {/* Kütüphane üst seviyede (Codex IA önerisi): üretilen çıktılar
           keşfedilebilir olsun — Araçlar açılır listesine gömülmesin. */}
        <button
          onClick={() => router.push("/library")}
          aria-current={pathname.startsWith("/library") ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/library") ? "bg-brand/10 text-brand" : "text-ink/85 hover:bg-bgsoft/70 hover:text-ink"
          }`}
        >
          <Images size={16} className="shrink-0" />
          <span className="flex-1 text-left">Kütüphane</span>
        </button>
      </nav>

      {/* Workspace accordion (Projects + History) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Projeler — Sohbetler ile aynı sebeple artık katlanamaz (eskiden
           AccordionSection'dı; localStorage'da bir kez kapatılırsa kalıcı
           kapalı kalıyordu — aktif projenin iç içe sohbetlerini gizleyebilirdi). */}
        <div className="pt-1 border-b border-line/40">
          <div className="flex items-stretch group/acc">
            <div className="flex-1 flex items-center gap-2 px-3 py-2">
              <FolderOpen size={11} className="text-muted/60 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/60 flex-1 truncate">Projeler</span>
              {config.projects.length > 0 && <span className="text-[10px] text-muted/40 font-mono shrink-0">{config.projects.length}</span>}
            </div>
            <div className="flex items-center pr-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/acc:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingProject(true);
                  setTimeout(() => document.getElementById("new-project-input")?.focus(), 30);
                }}
                title="Yeni proje"
                className="text-muted/50 hover:text-brand p-0.5 transition-colors"
              >
                <FolderPlus size={12} />
              </button>
            </div>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            {/* Projesiz görünüme dön — aktif bir proje varsa onu kapatır (klasörler
               tek seferde yalnız biri açık kalır, ChatGPT'nin Projects'i gibi). */}
            <button
              onClick={() => setActiveProject(null)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                !activeProject ? "bg-brand/10 text-brand" : "text-muted hover:text-ink hover:bg-bgsoft/60"
              }`}
            >
              <Layers size={13} className="shrink-0" />
              <span className="flex-1 text-[12px] font-medium truncate">Projesiz sohbetler</span>
              {!activeProject && <Check size={12} className="shrink-0" />}
            </button>

            {/* Proje listesi */}
            {config.projects.map((p) => {
              const active = activeProject === p.id;
              const count = projectCounts.get(p.id) ?? 0;
              if (editingProjectId === p.id) {
                return (
                  <div key={p.id} className="flex items-center gap-1 px-1.5 py-1">
                    <Folder size={13} className="shrink-0 text-muted/60" />
                    <input
                      autoFocus
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRenameProject();
                        if (e.key === "Escape") { setEditingProjectId(null); setEditProjectName(""); }
                      }}
                      onBlur={submitRenameProject}
                      className="flex-1 min-w-0 bg-bgsoft border border-brand/40 rounded-md px-2 py-1 text-[12px] outline-none"
                    />
                  </div>
                );
              }
              return (
                <div key={p.id}>
                  <div
                    className={`group/proj flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      active ? "bg-brand/10 text-brand" : "text-muted hover:text-ink hover:bg-bgsoft/60"
                    }`}
                    onClick={() => setActiveProject(active ? null : p.id)}
                    title={p.description || p.name}
                  >
                    {/* Klasör aç/kapa oku — ChatGPT'nin Projects'i gibi, sohbetler
                       kendi başlığının altında iç içe (nested) gösterilir. */}
                    <ChevronDown size={10} className={`shrink-0 text-muted/40 transition-transform ${active ? "" : "-rotate-90"}`} />
                    {p.icon ? (
                      <span className="text-[13px] leading-none shrink-0 w-3.5 text-center">{p.icon}</span>
                    ) : p.color ? (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 ml-0.5" style={{ background: projectColorHex(p.color) }} />
                    ) : active ? (
                      <FolderOpen size={13} className="shrink-0" />
                    ) : (
                      <Folder size={13} className="shrink-0" />
                    )}
                    <span className="flex-1 text-[12px] font-medium truncate">{p.name}</span>
                    {/* Sohbet sayısı rozeti — hover'da eylemlere yer açmak için gizlenir */}
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md shrink-0 group-hover/proj:hidden ${
                        active ? "bg-brand/15 text-brand/80" : "bg-bgsoft text-muted/60"
                      }`}>
                        {count}
                      </span>
                    )}
                    {/* Hover eylemleri: detay paneli / yeniden adlandır / sil */}
                    <div className="hidden group-hover/proj:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setProjectModalId(p.id); }}
                        title="Proje ayarları"
                        className="p-0.5 rounded text-muted/60 hover:text-brand transition-colors"
                      >
                        <Settings2 size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingProjectId(p.id); setEditProjectName(p.name); }}
                        title="Yeniden adlandır"
                        className="p-0.5 rounded text-muted/60 hover:text-brand transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`"${p.name}" projesi silinsin mi? (Sohbetler silinmez, projesiz kalır.)`)) removeProject(p.id); }}
                        title="Sil"
                        className="p-0.5 rounded text-muted/60 hover:text-red transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Nested: proje aktifken kendi sohbetleri hemen altında girintili görünür. */}
                  {active && (
                    <div className="pl-4 ml-3.5 border-l border-line/40 mt-0.5 mb-1 space-y-2">
                      {/* Bu projeye özel yeni sohbet — proje zaten aktif olduğundan
                         setActiveProject'e gerek yok, doğrudan newChat çağırmak yeterli
                         (yeni sohbet, oluşturulduğu anda mevcut activeProject'i alır). */}
                      <button
                        onClick={() => { newChat(false); closeOnMobile(); }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] text-muted/60 hover:text-brand hover:bg-bgsoft/60 transition-colors"
                      >
                        <Plus size={12} className="shrink-0" />
                        <span>Yeni sohbet</span>
                      </button>
                      {activeProjectSections.length === 0 ? (
                        <p className="text-[11px] text-muted/40 italic px-2 py-1">
                          {search && count > 0 ? "Eşleşen sohbet yok." : "Bu projede henüz sohbet yok."}
                        </p>
                      ) : (
                        activeProjectSections.map((sec) => (
                          <div key={sec.label}>
                            <div className="px-2 pt-0.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted/35 select-none">
                              {sec.label}
                            </div>
                            <div className="space-y-0.5">{sec.items.map(renderRow)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Satır-içi yeni proje girişi + şablonlar */}
            {addingProject && (
              <div className="px-1.5 py-1 space-y-1.5">
                <div className="flex items-center gap-1">
                  <FolderPlus size={13} className="shrink-0 text-brand/70" />
                  <input
                    id="new-project-input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNewProject();
                      if (e.key === "Escape") { setAddingProject(false); setNewProjectName(""); }
                    }}
                    onBlur={submitNewProject}
                    placeholder="Proje adı…"
                    className="flex-1 min-w-0 bg-bgsoft border border-brand/40 rounded-md px-2 py-1 text-[12px] outline-none placeholder:text-muted/35"
                  />
                </div>
                {/* Şablondan oluştur — mousedown ile (input blur'undan önce) çalışır */}
                <div className="flex flex-wrap gap-1 pl-5">
                  <span className="flex items-center gap-1 text-[10px] text-muted/50 pr-0.5"><Sparkles size={9} /> Şablon:</span>
                  {PROJECT_TEMPLATES.filter((t) => t.id !== "tpl-blank").map((t) => (
                    <button
                      key={t.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const id = addProjectFromTemplate(t);
                        setAddingProject(false);
                        setNewProjectName("");
                        setProjectModalId(id);
                      }}
                      title={t.description}
                      className="text-[10px] px-1.5 py-0.5 rounded-md border border-line/60 text-muted hover:text-ink hover:border-brand/40 transition-colors"
                    >
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boş durum + hızlı oluştur */}
            {config.projects.length === 0 && !addingProject && (
              <button
                onClick={() => { setAddingProject(true); setTimeout(() => document.getElementById("new-project-input")?.focus(), 30); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-line/60 text-muted/50 hover:text-brand hover:border-brand/40 transition-colors text-[11px]"
              >
                <FolderPlus size={13} /> İlk projeni oluştur
              </button>
            )}
          </div>
        </div>

        {/* Sohbet listesi — ChatGPT'nin ana listesi gibi her zaman açık, katlanamaz
           (eskiden AccordionSection'dı; kapalı kalıp yanlışlıkla gizlenebiliyordu).
           Yalnız PROJESİZ sohbetleri listeler — proje sohbetleri artık kendi
           klasörünün altında (nested) görünüyor, bkz. yukarıdaki Projeler. */}
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <MessageSquare size={11} className="text-muted/60 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted/60 flex-1 truncate">Sohbetler</span>
            {unassignedCount > 0 && <span className="text-[10px] text-muted/40 font-mono shrink-0">{unassignedCount}</span>}
          </div>
          <div className="px-2 pb-2">
            <div className="relative mb-2">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sohbetlerde ara (başlık + içerik)…"
                className="w-full bg-bgsoft/60 border border-line/60 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-brand/50 placeholder:text-muted/35 transition-colors"
              />
            </div>

            {unassignedHistory.length === 0 ? (
              <div className="text-center py-8 px-3">
                <Code2 size={20} className="mx-auto mb-2 text-muted/15" />
                <p className="text-[11px] text-muted/40 leading-relaxed">
                  {search ? "Eşleşen oturum yok." : "Henüz oturum yok."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((sec) => (
                  <div key={sec.label}>
                    <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/40 select-none">
                      {sec.label}
                    </div>
                    <div className="space-y-0.5">
                      {sec.items.map(renderRow)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* "İlgili" (Obsidian-lite) — yalnız aktif bir sohbet ve karşılaştıracak
            başka sohbet varsa gösterilir. Panel açılınca (lazy mount) hesaplanır. */}
        {currentId && history.length > 1 && (
          <AccordionSection id="related" title="İlgili" icon={<Link2 size={11} />}>
            <RelatedChats
              chats={history}
              currentId={currentId}
              onOpen={selectChat}
              onEmbeddings={updateChatEmbeddings}
            />
          </AccordionSection>
        )}
      </div>

      {/* Bottom — Claude'un sol alt köşesindeki hesap avatarı + sağ alttaki
         "New chat" ikon düğmesine paralel: iki yuvarlak ikon düğme, aynı
         satırda. Ayarlar butonu burada YOK (bilinçli, kullanıcı kararı):
         Ayarlar hesap menüsünün içinde (AuthButton), tema tercihi Ayarlar →
         Temel'de. Gizlilik/Şartlar/Çerezler linkleri de burada YOK — tek
         kaynak olarak yalnız Ayarlar → Hakkında'da (aynı işleve iki yol
         bırakmamak için). Hızlı erişim: Ctrl+, kısayolu ve ⌘K komutları. */}
      <div className="border-t border-line/60 shrink-0 px-3 py-3 flex items-center justify-between">
        <AuthButton />
        <button
          onClick={() => { newChat(false); closeOnMobile(); }}
          title="Yeni sohbet (Ctrl+N)"
          aria-label="Yeni sohbet"
          className="w-10 h-10 rounded-full bg-brand hover:bg-branddim text-[#111110] grid place-items-center transition-colors shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>
    </aside>
  );
}

/* "İlgili" listesi — mevcut sohbete anlamca en yakın 3-5 sohbeti gösterir
   (rag.ts'in tarayıcı-içi gömme modeli üzerinden, sunucuya veri gitmeden).
   Yalnız AccordionSection açıkken mount olur, böylece gereksiz yere
   çalışmaz. */
function RelatedChats({
  chats, currentId, onOpen, onEmbeddings,
}: {
  chats: Chat[];
  currentId: string;
  onOpen: (id: string) => void;
  onEmbeddings: (updates: { id: string; embedding: number[]; embeddingVersion: number }[]) => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [related, setRelated] = useState<{ item: Chat; score: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      const fresh = await withFreshEmbeddings(chats, (c) => c.messages.length, chatEmbeddingText);
      const changed = fresh
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c !== chats[i]);
      if (changed.length) {
        onEmbeddings(changed.map(({ c }) => ({ id: c.id, embedding: c.embedding!, embeddingVersion: c.embeddingVersion! })));
      }
      if (cancelled) return;
      const target = fresh.find((c) => c.id === currentId);
      if (!target?.embedding?.length) { setState("empty"); return; }
      const hits = findRelated(currentId, target.embedding, fresh, 5).filter((h) => h.score > 0.35);
      setRelated(hits);
      setState(hits.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, currentId]);

  if (state === "loading") {
    return <p className="text-[11px] text-muted/40 px-2 py-1.5">Aranıyor…</p>;
  }
  if (state === "empty") {
    return <p className="text-[11px] text-muted/40 px-2 py-1.5">İlgili sohbet bulunamadı.</p>;
  }
  return (
    <div className="space-y-0.5">
      {related.map(({ item, score }) => (
        <button
          key={item.id}
          onClick={() => onOpen(item.id)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors"
        >
          <Link2 size={11} className="shrink-0 opacity-40" />
          <span className="flex-1 text-[12px] truncate">{item.title}</span>
          <span className="text-[9px] font-mono text-muted/40 shrink-0">{Math.round(score * 100)}%</span>
        </button>
      ))}
    </div>
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

