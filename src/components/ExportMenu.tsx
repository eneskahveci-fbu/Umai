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
