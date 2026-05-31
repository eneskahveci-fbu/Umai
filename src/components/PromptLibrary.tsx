"use client";

import { useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";
import { PROMPT_TEMPLATES } from "@/lib/constants";

const CATEGORIES = [
  "Tümü",
  "Kod Yazma",
  "Hata Ayıklama",
  "Açıklama",
  "Refaktöring",
  "Test",
];

export function PromptLibrary() {
  const open = useStore((s) => s.promptLibraryOpen);
  const setOpen = useStore((s) => s.setPromptLibraryOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);

  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, open, () => setOpen(false));

  if (!open) return null;

  const filtered = PROMPT_TEMPLATES.filter((t) => {
    if (activeCategory !== "Tümü" && t.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectTemplate = (prompt: string) => {
    setPendingInput(prompt);
    setOpen(false);
    setSearch("");
    setActiveCategory("Tümü");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Prompt şablonları"
        className="w-full max-w-2xl mx-4 bg-surface border border-line rounded-2xl shadow-2xl flex flex-col max-h-[80dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-brand" />
            <h2 className="text-base font-bold">Prompt Kutuphanesi</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Prompt ara..."
            className="w-full bg-bgsoft border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand placeholder:text-muted/60"
            autoFocus
          />
        </div>

        {/* Category tabs */}
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeCategory === cat
                  ? "border-branddim bg-brand/10 text-brand font-semibold"
                  : "border-line text-muted hover:text-ink hover:border-branddim"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              Aramayla eslesen prompt bulunamadi.
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.prompt)}
                  className="text-left p-4 rounded-xl border border-line bg-bg hover:border-branddim hover:bg-bgsoft transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand/70 px-1.5 py-0.5 rounded bg-brand/10">
                      {t.category}
                    </span>
                    <span className="text-sm font-semibold group-hover:text-brand transition-colors">
                      {t.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {t.prompt}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
