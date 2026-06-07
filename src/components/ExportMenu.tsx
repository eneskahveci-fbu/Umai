"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clipboard, Code, Download, FileJson, FileText, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";

export function ExportMenu({ chatId }: { chatId: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const exportChat = useStore((s) => s.exportChat);
  const exportChatHtml = useStore((s) => s.exportChatHtml);
  const exportChatJson = useStore((s) => s.exportChatJson);
  const copyChatMarkdown = useStore((s) => s.copyChatMarkdown);
  const chats = useStore((s) => s.chats);

  const exportPdf = () => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>${chat.title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #1a1a2e; line-height: 1.6; }
  h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .meta { font-size: 0.75rem; color: #666; margin-bottom: 32px; }
  .msg { margin-bottom: 20px; }
  .role { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 4px; }
  .role.user { color: #6d4aff; }
  .content { background: #f5f5f7; border-radius: 8px; padding: 12px 16px; white-space: pre-wrap; font-size: 0.9rem; }
  pre { background: #f0f0f4; border-radius: 6px; padding: 10px 14px; overflow-x: auto; font-size: 0.8rem; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>${chat.title}</h1>
<div class="meta">craft.ai sohbeti · ${new Date(chat.created_at).toLocaleString("tr-TR")}</div>
${chat.messages.map((m) => `
<div class="msg">
  <div class="role ${m.role}">${m.role === "user" ? "Sen" : "craft.ai"}</div>
  <div class="content">${(m.content || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
</div>`).join("")}
</body>
</html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void | Promise<void>) => () => { setOpen(false); void fn(); };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-bgsoft"
        title="Bu sohbeti dışa aktar"
      >
        <Share2 size={12} />
        <span className="hidden sm:inline">Dışa aktar</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-line/60 bg-surface shadow-lg shadow-black/30 py-1 z-30 backdrop-blur-sm">
          <Item icon={<FileText size={12} />} label="Markdown indir (.md)"   onClick={run(() => exportChat(chatId))} />
          <Item icon={<FileJson size={12} />} label="JSON indir (.json)"      onClick={run(() => exportChatJson(chatId))} />
          <Item icon={<Code size={12} />}      label="HTML indir (.html)"     onClick={run(() => exportChatHtml(chatId))} />
          <Item icon={<Download size={12} />}  label="PDF olarak yazdır"      onClick={run(() => exportPdf())} />
          <div className="my-1 h-px bg-line/40" />
          <Item icon={<Clipboard size={12} />} label="Markdown'ı kopyala"    onClick={run(() => copyChatMarkdown(chatId))} />
        </div>
      )}
    </div>
  );
}

function Item({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors text-left"
    >
      <span className="text-muted/50">{icon}</span>
      {label}
    </button>
  );
}

/* Unused exported icon kept for future header use */
export { Download };
