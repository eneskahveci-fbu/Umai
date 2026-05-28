"use client";

import { useEffect, useState } from "react";
import { File } from "lucide-react";

interface MentionItem { path: string; }

interface Props {
  query: string;
  items: MentionItem[];
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export function MentionMenu({ query, items, onSelect, onClose }: Props) {
  const [active, setActive] = useState(0);
  const q = query.toLowerCase();
  const filtered = q
    ? items.filter((i) => i.path.toLowerCase().includes(q)).slice(0, 8)
    : items.slice(0, 8);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [filtered, active, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-2 left-3 right-3 max-h-60 overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 z-40 animate-fade-in">
      <div className="px-3 py-2 border-b border-line/40 text-[10px] uppercase tracking-widest text-muted/60 font-bold">
        Eklenmiş dosyalar
      </div>
      {filtered.map((item, i) => (
        <button
          key={item.path}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setActive(i)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
            i === active ? "bg-brand/10" : "hover:bg-bgsoft/60"
          }`}
        >
          <File size={12} className={`shrink-0 ${i === active ? "text-brand" : "text-muted/50"}`} />
          <span className={`text-xs font-mono truncate ${i === active ? "text-brand" : "text-ink"}`}>
            {item.path}
          </span>
        </button>
      ))}
    </div>
  );
}
