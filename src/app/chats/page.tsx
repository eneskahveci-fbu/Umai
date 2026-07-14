"use client";

/* Sohbetler — Sidebar'ın eskiden inline gösterdiği tarih-gruplu liste artık
   burada, ayrı bir sayfada (Tem 2026 kullanıcı kararı: Claude'a paralel
   bilgi mimarisi — Sidebar yalnız düz bir nav listesi tutar, sohbetler ve
   projeler kendi sayfalarına taşındı). Arama artık ⌘K'nın (CommandPalette)
   üstlendiği tek kaynak; bu sayfa yalnızca kendi basit filtre kutusunu
   tutar (aynı başlık+içerik kapsamı, ayrı bir "arama" konsepti değil). */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Code2,
  Copy,
  Download,
  FolderInput,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Share2,
  Tag,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuthGate, useThemeClasses } from "@/lib/authGate";
import type { Chat } from "@/lib/types";

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

function ActionIcon({
  children, title, danger, onClick,
}: {
  children: React.ReactNode; title: string; danger?: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${danger ? "text-muted/50 hover:text-red" : "text-muted/50 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

export default function ChatsPage() {
  const auth = useAuthGate();
  useThemeClasses();
  const router = useRouter();

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
  const addToast = useStore((s) => s.addToast);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!overflowMenuId) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chat-menu]")) setOverflowMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOverflowMenuId(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowMenuId]);

  if (auth !== "in") {
    return <div className="h-screen grid place-items-center bg-bg text-muted/60 text-sm">Yükleniyor…</div>;
  }

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

  const history = sortChats(chats.filter((c) => !c.incognito && matchesSearch(c)));
  const sections = toSections(history);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const commitRename = () => {
    if (editingId && editTitle.trim()) renameChat(editingId, editTitle.trim());
    setEditingId(null);
  };

  const openChat = (id: string) => {
    selectChat(id);
    router.push("/app");
  };

  const startNewChat = () => {
    newChat(false);
    router.push("/app");
  };

  const renderRow = (c: Chat) => (
    <div
      key={c.id}
      onClick={() => openChat(c.id)}
      className={`group/item flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 border ${
        currentId === c.id
          ? "bg-brand/10 border-brand/25 border-l-2 border-l-brand shadow-sm text-ink"
          : "border-line/60 bg-surface text-muted hover:text-ink hover:bg-bgsoft/60"
      }`}
    >
      <Code2 size={13} className={`shrink-0 ${currentId === c.id ? "text-brand/60" : "opacity-30"}`} />
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
        <span
          onDoubleClick={(e) => { e.stopPropagation(); startRename(c.id, c.title); }}
          className="flex-1 truncate text-sm"
          title="Çift tıkla yeniden adlandır"
        >
          {c.title || "Yeni sohbet"}
        </span>
      )}
      {c.pinned && <Pin size={10} className="text-brand/60 shrink-0" />}
      {c.tags && c.tags.length > 0 && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-brand/10 text-brand/70 font-mono shrink-0 max-w-[60px] truncate">
          {c.tags[0]}
        </span>
      )}
      <div className="relative shrink-0" data-chat-menu>
        <ActionIcon title="Daha fazla" onClick={(e) => { e.stopPropagation(); setOverflowMenuId(overflowMenuId === c.id ? null : c.id); }}>
          <MoreHorizontal size={13} />
        </ActionIcon>
        {overflowMenuId === c.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-line bg-surface elev-2 py-1 text-[12px]"
          >
            <button
              onClick={() => { setOverflowMenuId(null); pinChat(c.id, !c.pinned); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left"
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
              onClick={() => { setOverflowMenuId(null); const tag = window.prompt("Etiket (virgülle ayır):", c.tags?.join(", ") ?? ""); if (tag !== null) tagChat(c.id, tag.split(",").map((t) => t.trim()).filter(Boolean)); }}
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
            <div className="h-px bg-line/60 my-1" />
            <button
              onClick={() => { setOverflowMenuId(null); if (confirm(`"${c.title || "Bu sohbet"}" silinsin mi? Bu işlem geri alınamaz.`)) deleteChat(c.id); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bgsoft/70 text-left text-red-400"
            >
              <Trash2 size={12} /> Sil
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 h-14 border-b border-line bg-bg/90 backdrop-blur">
        <div className="max-w-3xl mx-auto h-full px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => router.push("/app")} className="w-10 h-10 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-bgsoft" title="Çalışma alanına dön" aria-label="Çalışma alanına dön">
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">Sohbetler</h1>
            <p className="text-[11px] text-muted">{history.length} sohbet</p>
          </div>
          <button
            onClick={startNewChat}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand hover:bg-branddim text-[#111110] text-xs font-semibold transition-colors"
          >
            <Plus size={14} /> Yeni sohbet
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbetlerde ara (başlık + içerik)…"
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-brand/50 placeholder:text-muted/40 transition-colors"
          />
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16 px-3">
            <Code2 size={24} className="mx-auto mb-3 text-muted/15" />
            <p className="text-sm text-muted/50">{search ? "Eşleşen sohbet yok." : "Henüz sohbet yok."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((sec) => (
              <div key={sec.label}>
                <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted/50 select-none">
                  {sec.label}
                </div>
                <div className="space-y-1.5">
                  {sec.items.map(renderRow)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
