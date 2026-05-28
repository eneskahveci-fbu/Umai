"use client";

import { useRef, useState } from "react";
import { BookmarkPlus, Check, Copy, Eye, GitCompareArrows } from "lucide-react";
import { useStore } from "@/lib/store";

export function CodeBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const className =
    (codeChild as React.ReactElement<{ className?: string }>)?.props?.className || "";
  const lang = className
    .replace(/language-/g, "")
    .replace(/hljs/g, "")
    .trim();

  const isPreviewable = ["html", "svg", "htm"].includes(lang);

  const getText = () => preRef.current?.textContent || "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* yoksay */ }
  };

  const preview = () => {
    useStore.getState().setArtifact({
      type: lang === "svg" ? "svg" : "html",
      content: getText(),
      title: `${lang.toUpperCase()} Önizleme`,
    });
  };

  const saveSnippet = () => {
    const code = getText().trim();
    if (!code) return;
    const firstLine = code.split("\n")[0].slice(0, 60);
    const title = firstLine.replace(/^\s*[/#-]+\s*/, "").trim() || `${lang || "code"} snippet`;
    useStore.getState().addSnippet({ title, language: lang || "text", code });
    useStore.getState().addToast("Snippet kaydedildi", "success");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const showDiff = () => {
    const newCode = getText();
    /* find an attached file with same language or just take the first */
    const path = window.prompt(
      "Hangi dosya ile karşılaştır? (yolu yapıştır, boş bırakırsan boş orijinalle karşılaştırır)",
      "",
    );
    useStore.getState().setDiffModal({
      original: "",
      newCode,
      language: lang || "text",
      path: path || undefined,
    });
    /* if user provided a path, try to find content in attached files state — handled in CoderView */
    if (path) {
      window.dispatchEvent(new CustomEvent("craftai:diff-request", {
        detail: { path, newCode, language: lang || "text" },
      }));
    }
  };

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#0c0e14] rounded-t-[10px] border border-b-0 border-line text-xs text-muted">
        <span className="font-mono">{lang || "code"}</span>
        <div className="flex items-center gap-2.5">
          {isPreviewable && (
            <button onClick={preview} className="flex items-center gap-1 hover:text-brand transition-colors">
              <Eye size={12} /> Önizle
            </button>
          )}
          <button onClick={showDiff} className="flex items-center gap-1 hover:text-brand transition-colors" title="Bir dosya ile karşılaştır">
            <GitCompareArrows size={12} /> Diff
          </button>
          <button onClick={saveSnippet} className="flex items-center gap-1 hover:text-brand transition-colors" title="Snippet kütüphanesine kaydet">
            {saved ? <><Check size={12} /> Kaydedildi</> : <><BookmarkPlus size={12} /> Kaydet</>}
          </button>
          <button onClick={copy} className="flex items-center gap-1 hover:text-ink transition-colors">
            {copied ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
          </button>
        </div>
      </div>
      <pre ref={preRef} {...props} className="!rounded-t-none !mt-0 !border-t-0">
        {children}
      </pre>
    </div>
  );
}
