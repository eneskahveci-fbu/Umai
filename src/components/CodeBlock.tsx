"use client";

import { useRef, useState } from "react";
import { Check, Copy, Eye } from "lucide-react";
import { useStore } from "@/lib/store";

export function CodeBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const className =
    (codeChild as React.ReactElement<{ className?: string }>)?.props?.className || "";
  const lang = className
    .replace(/language-/g, "")
    .replace(/hljs/g, "")
    .trim();

  const isPreviewable = ["html", "svg", "htm"].includes(lang);

  const copy = async () => {
    const text = preRef.current?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* yoksay */
    }
  };

  const preview = () => {
    const text = preRef.current?.textContent || "";
    useStore.getState().setArtifact({
      type: lang === "svg" ? "svg" : "html",
      content: text,
      title: `${lang.toUpperCase()} Önizleme`,
    });
  };

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#0c0e14] rounded-t-[10px] border border-b-0 border-line text-xs text-muted">
        <span className="font-mono">{lang || "code"}</span>
        <div className="flex items-center gap-2">
          {isPreviewable && (
            <button
              onClick={preview}
              className="flex items-center gap-1 hover:text-brand transition-colors"
            >
              <Eye size={12} /> Önizle
            </button>
          )}
          <button
            onClick={copy}
            className="flex items-center gap-1 hover:text-ink transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} /> Kopyalandı
              </>
            ) : (
              <>
                <Copy size={12} /> Kopyala
              </>
            )}
          </button>
        </div>
      </div>
      <pre ref={preRef} {...props} className="!rounded-t-none !mt-0 !border-t-0">
        {children}
      </pre>
    </div>
  );
}
