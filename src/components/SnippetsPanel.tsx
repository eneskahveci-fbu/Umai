"use client";

import { useRef, useState } from "react";
import { Code2, Copy, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";

export function SnippetsPanel() {
  const open = useStore((s) => s.snippetsOpen);
  const setOpen = useStore((s) => s.setSnippetsOpen);
  const snippets = useStore((s) => s.snippets);
  const removeSnippet = useStore((s) => s.removeSnippet);
  const reorderSnippets = useStore((s) => s.reorderSnippets);
  const addToast = useStore((s) => s.addToast);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));

  if (!open) return null;

  const filtered = search
    ? snippets.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.language.toLowerCase().includes(search.toLowerCase()),
      )
    : snippets;

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      addToast("Kopyalandı", "success");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      addToast("Kopyalanamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm grid place-items-center px-4 animate-modal-bg"
      onClick={() => setOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Snippet kütüphanesi"
        className="w-full max-w-3xl h-[80dvh] bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center">
              <Code2 size={14} className="text-brand" />
            </div>
            <h2 className="font-bold text-base">Snippet Kütüphanesi</h2>
            <span className="text-[11px] text-muted/60 font-mono">{snippets.length}</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-line/40 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Snippet ara (başlık, kod, dil)…"
              className="w-full bg-bgsoft/60 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Code2 size={28} className="mx-auto mb-3 text-muted/15" />
              <p className="text-sm text-muted/40">
                {snippets.length === 0
                  ? "Henüz snippet kaydetmedin.\nAI kod bloklarındaki 'Kaydet' butonuyla ekle."
                  : "Eşleşen snippet yok."}
              </p>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragId(s.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== s.id) reorderSnippets(dragId, s.id);
                }}
                className={`bg-bgsoft/40 border border-line/60 rounded-xl overflow-hidden transition-opacity cursor-grab active:cursor-grabbing ${dragId === s.id ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-line/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold truncate">{s.title}</span>
                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand/10 text-brand/80 shrink-0">
                      {s.language}
                    </code>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copy(s.id, s.code)}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
                    >
                      <Copy size={11} />
                      {copiedId === s.id ? "Kopyalandı" : "Kopyala"}
                    </button>
                    <button
                      onClick={() => removeSnippet(s.id)}
                      className="text-muted/50 hover:text-red p-1.5 rounded transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <pre className="text-[11px] font-mono px-3 py-2 overflow-x-auto max-h-44 bg-[#0a0a0d] text-muted/80 leading-relaxed">
                  <code>{s.code}</code>
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
