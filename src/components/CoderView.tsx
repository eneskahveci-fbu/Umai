"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import {
  Code2,
  Terminal,
  FileText,
  Folder,
  FolderOpen,
  Play,
  RefreshCw,
  GitBranch,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
} from "lucide-react";

// ── Basit dosya ağacı ──

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const p of paths.sort()) {
    const parts = p.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === name);

      if (!existing) {
        existing = {
          name,
          path: fullPath,
          type: isLast ? "file" : "folder",
          children: isLast ? undefined : [],
        };
        current.push(existing);
      }

      if (!isLast && existing.children) {
        current = existing.children;
      }
    }
  }

  return root;
}

function getFileIcon(name: string): React.ReactNode {
  const ext = name.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: "📘",
    tsx: "📘",
    js: "📒",
    jsx: "📒",
    css: "🎨",
    html: "🌐",
    json: "📋",
    md: "📝",
    svg: "🖼️",
    py: "🐍",
    rs: "🦀",
    go: "🔵",
  };
  return iconMap[ext ?? ""] ?? "📄";
}

// ── Bileşen ──

export function CoderView() {
  const [activeTab, setActiveTab] = useState<"files" | "console">("files");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "Craft.Coder Terminal v1.0",
    'Hazır. "help" yazarak komutları görebilirsin.',
  ]);

  // Placeholder dosya ağacı
  const [repoFiles] = useState<string[]>([
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/app/globals.css",
    "src/components/Sidebar.tsx",
    "src/components/CoderView.tsx",
    "src/lib/store.ts",
    "src/lib/types.ts",
    "package.json",
    "tsconfig.json",
    "README.md",
  ]);

  const tree = buildTree(repoFiles);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleFileClick = (path: string) => {
    setSelectedFile(path);
    setFileContent(`// ${path}\n// Dosya içeriği burada görünecek.\n`);
  };

  const handleTerminalCommand = (cmd: string) => {
    setTerminalHistory((prev) => [...prev, `$ ${cmd}`]);
    setTerminalInput("");

    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === "help") {
      setTerminalHistory((prev) => [
        ...prev,
        "  help        Bu mesajı gösterir",
        "  clear       Terminali temizler",
        "  ls          Dosyaları listeler",
        "  git status  Git durumunu gösterir",
        "  build       Projeyi derler",
      ]);
    } else if (trimmed === "clear") {
      setTerminalHistory([]);
    } else if (trimmed === "ls") {
      setTerminalHistory((prev) => [...prev, ...repoFiles.map((f) => `  ${f}`)]);
    } else if (trimmed === "git status") {
      setTerminalHistory((prev) => [
        ...prev,
        "  On branch main",
        "  nothing to commit, working tree clean",
      ]);
    } else if (trimmed === "build") {
      setTerminalHistory((prev) => [...prev, "  Derleme başarılı ✅"]);
    } else {
      setTerminalHistory((prev) => [...prev, `  komut bulunamadı: ${cmd}`]);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <GitBranch size={14} className="text-muted" />
            <span className="text-xs font-mono text-muted">main</span>
          </div>
          <div className="h-4 w-px bg-line" />
          <span className="text-xs text-muted">eneskahveci.bs/craft-ai-web</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 hover:bg-bgsoft rounded-lg transition-colors"
            title="Yenile"
            aria-label="Yenile"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main content: File tree + Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree panel */}
        <div className="w-56 border-r border-line bg-surface overflow-y-auto shrink-0">
          <div className="px-3 py-2 border-b border-line">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">
              Dosyalar
            </span>
          </div>

          <div className="py-1">
            {tree.map((node) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                depth={0}
                expanded={expandedFolders}
                onToggle={toggleFolder}
                onFileClick={handleFileClick}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-line bg-surface px-2">
            <button
              onClick={() => setActiveTab("files")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === "files"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Code2 size={14} />
              Editör
            </button>
            <button
              onClick={() => setActiveTab("console")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === "console"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Terminal size={14} />
              Terminal
            </button>
          </div>

          {/* Editor content */}
          {activeTab === "files" && (
            <div className="flex-1 overflow-auto">
              {selectedFile ? (
                <pre className="p-4 text-sm font-mono text-ink whitespace-pre-wrap">
                  <code>{fileContent}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-muted text-sm">
                  <div className="text-center">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Görüntülemek için bir dosya seçin</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Terminal */}
          {activeTab === "console" && (
            <div className="flex-1 flex flex-col bg-[#0d1117] text-green-400 font-mono text-xs">
              <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                {terminalHistory.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-800">
                <span className="text-green-500">$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTerminalCommand(terminalInput);
                    }
                  }}
                  placeholder="Komut yaz..."
                  className="flex-1 bg-transparent outline-none text-green-400 placeholder:text-gray-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-line bg-surface text-[10px] text-muted">
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>LF</span>
          <span>TypeScript React</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ln 1, Col 1</span>
          <span>Boşluk: 2</span>
        </div>
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  expanded,
  onToggle,
  onFileClick,
  selectedFile,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (p: string) => void;
  onFileClick: (p: string) => void;
  selectedFile: string | null;
}) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedFile === node.path;
  const paddingLeft = 8 + depth * 16;

  if (node.type === "folder") {
    return (
      <>
        <button
          onClick={() => onToggle(node.path)}
          className="w-full flex items-center gap-1 py-1 text-left hover:bg-bgsoft transition-colors text-sm"
          style={{ paddingLeft }}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-muted shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-muted shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} className="text-amber-400/70 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-400/70 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded &&
          node.children?.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onFileClick={onFileClick}
              selectedFile={selectedFile}
            />
          ))}
      </>
    );
  }

  return (
    <button
      onClick={() => onFileClick(node.path)}
      className={`w-full flex items-center gap-1 py-1 text-left transition-colors text-sm ${
        isSelected ? "bg-amber-400/10 text-amber-400" : "hover:bg-bgsoft text-ink"
      }`}
      style={{ paddingLeft: paddingLeft + 20 }}
    >
      <span className="text-xs shrink-0">{getFileIcon(node.name)}</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}
