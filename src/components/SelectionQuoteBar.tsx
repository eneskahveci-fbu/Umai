"use client";

import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  onQuote: (text: string) => void;
}

/* Claude.ai'daki "seçili metni sor" davranışı: asistan yanıtından bir metin
   seçilince küçük bir "Alıntıla ve sor" butonu belirir; tıklanınca seçili
   metin blockquote olarak composer'a eklenir. Yalnız .prose-chat (asistan
   markdown çıktısı) içindeki seçimler tetikler — kullanıcı balonunda değil,
   Claude'daki gibi yalnız asistan yanıtları alıntılanabilir. */
export function SelectionQuoteBar({ containerRef, onQuote }: Props) {
  const [state, setState] = useState<{ text: string; top: number; left: number } | null>(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const container = containerRef.current;
      if (!container) { setState(null); return; }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setState(null); return; }
      const text = sel.toString().trim();
      if (!text) { setState(null); return; }
      const anchor = sel.anchorNode;
      const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
      if (!anchorEl || !container.contains(anchorEl) || !anchorEl.closest(".prose-chat")) {
        setState(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { setState(null); return; }
      setState({ text, top: rect.top, left: rect.left + rect.width / 2 });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [containerRef]);

  if (!state) return null;

  return (
    <button
      onClick={() => {
        onQuote(state.text);
        window.getSelection()?.removeAllRanges();
        setState(null);
      }}
      style={{ position: "fixed", top: Math.max(8, state.top - 42), left: state.left, transform: "translateX(-50%)" }}
      className="animate-fade-in z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface elev-2 text-xs font-medium text-ink hover:border-brand/40 transition-colors"
    >
      <Quote size={12} className="text-brand" /> Alıntıla ve sor
    </button>
  );
}
