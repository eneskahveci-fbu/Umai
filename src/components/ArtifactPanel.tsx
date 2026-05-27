"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);
  const [expanded, setExpanded] = useState(false);

  if (!artifact) return null;

  const srcdoc =
    artifact.type === "svg"
      ? `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0e0e13;}</style></head><body>${artifact.content}</body></html>`
      : artifact.content.includes("<html")
        ? artifact.content
        : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${artifact.content}</body></html>`;

  return (
    <div
      className={`shrink-0 border-l border-line bg-surface flex flex-col transition-all ${
        expanded ? "fixed inset-0 z-50" : "w-[520px]"
      }`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line">
        <span className="text-sm font-semibold truncate">
          {artifact.title || "Önizleme"}
        </span>
        <div className="flex items-center gap-1">
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
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-modals"
          className="w-full h-full border-0"
          title="Artifact preview"
        />
      </div>
    </div>
  );
}
