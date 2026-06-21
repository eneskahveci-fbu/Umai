"use client";

import { ExternalLink, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (!artifact) return null;

  const srcdoc =
    artifact.type === "mermaid"
      ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script><style>body{margin:1.5rem;background:#fff;font-family:system-ui,sans-serif;}</style></head><body><div class="mermaid">${artifact.content}</div><script>mermaid.initialize({startOnLoad:true,theme:'default'});<\/script></body></html>`
      : artifact.type === "svg"
        ? `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111110;}</style></head><body>${artifact.content}</body></html>`
        : artifact.content.includes("<html")
          ? artifact.content
          : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${artifact.content}</body></html>`;

  return (
    <div
      role="region"
      aria-label={artifact.title || "Önizleme"}
      className={`shrink-0 border-line bg-surface flex flex-col transition-all ${
        expanded ? "fixed inset-0 z-50" : "w-full h-full"
      }`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
        <span className="text-sm font-semibold truncate">
          {artifact.title || "Önizleme"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"
            title="Yenile"
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={() => {
              const blob = new Blob([srcdoc], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank", "noopener");
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"
            title="Yeni sekmede aç"
          >
            <ExternalLink size={15} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            onClick={() => {
              setArtifact(null);
              setExpanded(false);
            }}
            className="text-muted hover:text-ink p-1 rounded hover:bg-bgsoft"
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-white">
        <iframe
          key={reloadKey}
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-modals"
          allow=""
          referrerPolicy="no-referrer"
          className="w-full h-full border-0"
          title="Artifact preview"
        />
      </div>
    </div>
  );
}
