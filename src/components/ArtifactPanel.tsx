"use client";

import { Check, Code2, Copy, Download, ExternalLink, Eye, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  if (!artifact) return null;

  const srcdoc =
    artifact.type === "mermaid"
      ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script><style>body{margin:1.5rem;background:#fff;font-family:system-ui,sans-serif;}</style></head><body><div class="mermaid">${artifact.content}</div><script>mermaid.initialize({startOnLoad:true,theme:'default'});<\/script></body></html>`
      : artifact.type === "svg"
        ? `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111110;}</style></head><body>${artifact.content}</body></html>`
        : artifact.content.includes("<html")
          ? artifact.content
          : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${artifact.content}</body></html>`;

  const ext = artifact.type === "svg" ? "svg" : artifact.type === "mermaid" ? "mmd" : "html";
  const downloadBody = artifact.type === "html" ? srcdoc : artifact.content;

  const copySource = async () => {
    try { await navigator.clipboard.writeText(artifact.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { useStore.getState().addToast("Kopyalanamadı", "error"); }
  };
  const download = () => {
    const mime = artifact.type === "svg" ? "image/svg+xml" : "text/plain";
    const blob = new Blob([downloadBody], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(artifact.title || "artifact").replace(/\s+/g, "-").toLowerCase()}.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const iconBtn = "text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors";

  return (
    <div
      role="region"
      aria-label={artifact.title || "Önizleme"}
      className={`shrink-0 border-line bg-surface flex flex-col transition-all ${
        expanded ? "fixed inset-0 z-50" : "w-full h-full"
      }`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-line gap-2">
        <span className="text-sm font-semibold truncate min-w-0">{artifact.title || "Önizleme"}</span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Önizleme / Kod geçişi (Claude Artifacts gibi) */}
          <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 mr-1">
            <button onClick={() => setView("preview")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "preview" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Önizleme"><Eye size={12} /> Önizleme</button>
            <button onClick={() => setView("code")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Kaynak kod"><Code2 size={12} /> Kod</button>
          </div>

          <button onClick={copySource} className={iconBtn} title="Kaynağı kopyala">{copied ? <Check size={15} className="text-brand" /> : <Copy size={15} />}</button>
          <button onClick={download} className={iconBtn} title="İndir"><Download size={15} /></button>
          {view === "preview" && (
            <>
              <button onClick={() => setReloadKey((k) => k + 1)} className={iconBtn} title="Yenile"><RotateCw size={15} /></button>
              <button
                onClick={() => {
                  const blob = new Blob([srcdoc], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank", "noopener");
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }}
                className={iconBtn} title="Yeni sekmede aç"
              ><ExternalLink size={15} /></button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)} className={iconBtn} title={expanded ? "Küçült" : "Büyüt"}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <button onClick={() => { setArtifact(null); setExpanded(false); }} className={iconBtn} title="Kapat"><X size={15} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white">
        {view === "preview" ? (
          <iframe
            key={reloadKey}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-modals"
            allow=""
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
            title="Artifact preview"
          />
        ) : (
          <pre className="w-full h-full overflow-auto m-0 p-4 text-[12px] leading-relaxed font-mono bg-[#0b0b0d] text-[#d6d6d6]"><code>{artifact.content}</code></pre>
        )}
      </div>
    </div>
  );
}
