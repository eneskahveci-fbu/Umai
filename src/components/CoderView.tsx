"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { ArtifactPanel } from "./ArtifactPanel";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export function CoderView() {
  const { repoFiles, project, sidebarOpen } = useStore();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set());

  // Dosya listesini ağaç yapısına çevir
  const fileTree = buildFileTree(repoFiles);

  const toggleDir = (path: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleFileClick = async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    try {
      // Gerçek uygulamada API'den dosya içeriği çekilir
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `read_file: ${path}` }],
          tools: false,
          repoCtx: project,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: string };
        setFileContent(data.content ?? "// Dosya içeriği yüklenemedi");
      }
    } catch {
      setFileContent("// Dosya yüklenirken hata oluştu");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full" data-tour="coder-view">
      {/* Dosya ağacı paneli */}
      <div className="w-56 border-r border-[var(--color-surface)] overflow-y-auto bg-[var(--color-bg)] shrink-0">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-ink)]/40 font-medium">
          Dosyalar
        </div>
        {repoFiles.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-ink)]/40">
            {project ? "Dosyalar yükleniyor..." : "Bir repoya bağlanın"}
          </div>
        ) : (
          <FileTree
            nodes={fileTree}
            expanded={treeExpanded}
            onToggle={toggleDir}
            selectedFile={selectedFile}
            onSelectFile={handleFileClick}
          />
        )}
      </div>

      {/* Editör + sohbet */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Monaco Editör (placeholder) */}
        <div className="flex-1 bg-[var(--color-bg)] overflow-auto">
          {selectedFile ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)]/50 border-b border-[var(--color-surface)] text-xs">
                <span className="text-[var(--color-ink)]/40">📄</span>
                <span className="font-mono text-[var(--color-ink)]/70 truncate">{selectedFile}</span>
              </div>
              <div className="flex-1 overflow-auto font-mono text-sm p-4 whitespace-pre-wrap text-[var(--color-ink)]/80">
                {loading ? (
                  <span className="text-[var(--color-ink)]/40 animate-pulse">Yükleniyor...</span>
                ) : (
                  fileContent || "// Dosya seçilmedi"
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-ink)]/30">
              <div className="text-center">
                <div className="text-4xl mb-4">🧑‍💻</div>
                <p className="text-sm">Düzenlemek için bir dosya seçin</p>
              </div>
            </div>
          )}
        </div>

        {/* Alt panel: Sohbet + Terminal (basit placeholder) */}
        <div className="h-48 border-t border-[var(--color-surface)] bg-[var(--color-surface)]/20">
          <div className="flex items-center border-b border-[var(--color-surface)] text-xs">
            <button className="px-4 py-1.5 border-b-2 border-[var(--color-brand)] text-[var(--color-brand)]">
              Sohbet
            </button>
            <button className="px-4 py-1.5 text-[var(--color-ink)]/40 hover:text-[var(--color-ink)]/60">
              Terminal
            </button>
          </div>
          <div className="p-3 text-xs text-[var(--color-ink)]/40">
            Coder sohbeti burada görünecek
          </div>
        </div>
      </div>

      {/* Artifact paneli */}
      <ArtifactPanel />
    </div>
  );
}

/* ── Dosya ağacı yardımcıları ── */

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const p of paths.sort()) {
    const parts = p.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === name);
      if (!node) {
        node = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
        };
        current.push(node);
      }
      if (!isFile && node.children) {
        current = node.children;
      }
    }
  }

  return root;
}

function FileTree({
  nodes,
  expanded,
  onToggle,
  selectedFile,
  onSelectFile,
  depth = 0,
}: {
  nodes: FileNode[];
  expanded: Set<string>;
  onToggle: (p: string) => void;
  selectedFile: string | null;
  onSelectFile: (p: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.path}>
          <button
            onClick={() => (n.type === "dir" ? onToggle(n.path) : onSelectFile(n.path))}
            className={`w-full flex items-center gap-1.5 px-3 py-1 text-xs transition-colors hover:bg-[var(--color-surface)] text-left ${
              selectedFile === n.path
                ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "text-[var(--color-ink)]/60"
            }`}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <span className="w-4 text-center shrink-0">
              {n.type === "dir" ? (expanded.has(n.path) ? "📂" : "📁") : "📄"}
            </span>
            <span className="truncate">{n.name}</span>
          </button>
          {n.type === "dir" && expanded.has(n.path) && n.children && (
            <FileTree
              nodes={n.children}
              expanded={expanded}
              onToggle={onToggle}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}
