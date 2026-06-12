"use client";

import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Terminal as TerminalIcon,
  Code2,
  MessageSquare,
  GitBranch,
  ExternalLink,
  PanelBottomOpen,
  PanelBottomClose,
  FolderOpen,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useStore } from "@/lib/store";

// ── Basit dosya ağacı düğümü ──

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

function FileTreeNode({
  node,
  depth,
  onSelect,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (path: string) => void;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isDir = node.type === "dir";
  const isExpanded = expanded.has(node.path);
  const paddingLeft = 12 + depth * 16;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) onToggle(node.path);
          else onSelect(node.path);
        }}
        className="w-full flex items-center gap-1.5 hover:bg-bgsoft/50 transition-colors text-left"
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px", paddingTop: "2px", paddingBottom: "2px" }}
      >
        {isDir ? (
          <>
            <span className="text-muted/50 shrink-0">
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={13} className="text-amber-400/70 shrink-0" />
            ) : (
              <Folder size={13} className="text-amber-400/60 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-[10px] shrink-0" />
            <File size={13} className="text-muted/50 shrink-0" />
          </>
        )}
        <span className={`text-[11px] truncate ${isDir ? "font-medium" : "text-muted"}`}>
          {node.name}
        </span>
      </button>
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ana CoderView ──

export function CoderView() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string; branch: string } | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const addToast = useStore((s) => s.addToast);

  // Repo bilgisini al
  useEffect(() => {
    const projects = useStore.getState().projects;
    if (projects.length > 0) {
      const p = projects[0];
      setRepoInfo({
        owner: p.repoOwner ?? "",
        repo: p.repoName ?? "",
        branch: p.branch ?? "main",
      });
      loadTree(p.repoOwner ?? "", p.repoName ?? "", p.branch ?? "main");
    }
  }, []);

  const loadTree = useCallback(async (owner: string, repo: string, branch: string) => {
    if (!owner || !repo) return;
    setLoading(true);
    try {
      const provider = useStore.getState().projects[0]?.provider ?? "github";
      const base = provider === "github"
        ? `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        : `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/tree?ref=${branch}&recursive=true&per_page=500`;

      const headers: Record<string, string> = {};
      const token = useStore.getState().projects[0]?.token;
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(base, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (provider === "github") {
        const data = await res.json();
        const nodes = buildTreeFromGitHub(data.tree ?? []);
        setTree(nodes);
      } else {
        const data = await res.json();
        const nodes = buildTreeFromGitLab(data ?? []);
        setTree(nodes);
      }
    } catch (err) {
      addToast({ message: `Repo yüklenemedi: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleFileSelect = useCallback(async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    try {
      const owner = repoInfo?.owner;
      const repo = repoInfo?.repo;
      if (!owner || !repo) return;
      const provider = useStore.getState().projects[0]?.provider ?? "github";
      const token = useStore.getState().projects[0]?.token;

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let url: string;
      if (provider === "github") {
        url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${repoInfo?.branch ?? "main"}`;
        headers["Accept"] = "application/vnd.github.v3.raw";
      } else {
        const projectId = encodeURIComponent(`${owner}/${repo}`);
        url = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(path)}/raw?ref=${repoInfo?.branch ?? "main"}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFileContent(await res.text());
    } catch (err) {
      setFileContent(`// Dosya yüklenemedi: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  }, [repoInfo]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleSendChat = useCallback(async () => {
    const input = chatInput.trim();
    if (!input) return;
    setChatMessages((prev) => [...prev, { role: "user", content: input }]);
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "assistant", content: "Düşünüyorum..." }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: input },
          ],
          model: useStore.getState().models.find((m) => m.enabled)?.modelId ?? "gpt-4o",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream desteklenmiyor");

      const decoder = new TextDecoder();
      let fullResponse = "";

      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "" };
        return copy;
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              fullResponse += delta;
              setChatMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: fullResponse };
                return copy;
              });
            } catch { /* partial chunk */ }
          }
        }
      }
    } catch (err) {
      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Hata: ${err instanceof Error ? err.message : "Beklenmeyen hata"}`,
        };
        return copy;
      });
    }
  }, [chatInput, chatMessages]);

  const fileName = selectedFile?.split("/").pop() ?? "";
  const language = fileName.includes(".")
    ? (fileName.split(".").pop() ?? "plaintext")
    : "plaintext";

  return (
    <div className="flex-1 min-w-0 flex">
      {/* Dosya ağacı */}
      <div className="w-56 shrink-0 border-r border-line bg-surface/50 flex flex-col">
        <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-line">
          <div className="flex items-center gap-1.5">
            <GitBranch size={12} className="text-muted/60" />
            <span className="text-[10px] font-mono text-muted truncate">
              {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : "Repo yok"}
            </span>
          </div>
          <button
            onClick={() => repoInfo && loadTree(repoInfo.owner, repoInfo.repo, repoInfo.branch)}
            disabled={loading}
            className="text-muted/50 hover:text-ink p-0.5 transition-colors"
            title="Yenile"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading && tree.length === 0 && (
            <p className="text-[11px] text-muted/60 text-center py-8">Yükleniyor...</p>
          )}
          {!loading && tree.length === 0 && (
            <p className="text-[11px] text-muted/60 text-center py-8 px-3">
              Ayarlar → Git sekmesinden bir repo bağlayın.
            </p>
          )}
          {tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={handleFileSelect}
              expanded={expanded}
              onToggle={toggleExpand}
            />
          ))}
        </div>
      </div>

      {/* Editör + Sohbet */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Editör alanı */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Sekme bar */}
          <div className="h-9 shrink-0 flex items-center gap-1 px-2 border-b border-line bg-surface/30 overflow-x-auto">
            {selectedFile ? (
              <div className="flex items-center gap-1.5 px-3 h-7 rounded-t-lg bg-bg border border-line border-b-0 text-[11px] shrink-0">
                <File size={11} className="text-muted/60" />
                <span className="truncate max-w-[200px]">{fileName}</span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-muted/40 hover:text-ink ml-0.5"
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-muted/50 px-2">Dosya seçilmedi</span>
            )}
          </div>

          {/* Kod görüntüleyici */}
          <div className="flex-1 bg-bg overflow-auto">
            {!selectedFile ? (
              <div className="flex flex-col items-center justify-center h-full text-muted/50 gap-2">
                <Code2 size={28} />
                <p className="text-xs">Dosya ağacından bir dosya seçin</p>
              </div>
            ) : (
              <pre className={`p-4 text-xs font-mono leading-relaxed whitespace-pre overflow-auto h-full language-${language}`}>
                <code>{fileContent}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Sohbet paneli */}
        <div className={`shrink-0 border-t border-line bg-surface transition-all ${chatOpen ? "h-64" : "h-0 overflow-hidden border-t-0"}`}>
          <div className="h-9 flex items-center justify-between px-3 border-b border-line">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={12} className="text-muted/60" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
                Sohbet
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTerminalOpen(!terminalOpen)}
                className={`p-1 rounded text-[10px] transition-colors ${
                  terminalOpen ? "text-amber-400 bg-amber-400/10" : "text-muted/50 hover:text-ink"
                }`}
                title="Terminal"
              >
                <TerminalIcon size={11} />
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="text-muted/50 hover:text-ink p-0.5 transition-colors"
                title="Kapat"
              >
                <PanelBottomClose size={12} />
              </button>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ height: "calc(100% - 36px - 44px)" }}>
            {chatMessages.length === 0 && (
              <p className="text-xs text-muted/50 text-center py-4">
                Dosya hakkında soru sorun veya kod yazdırın.
              </p>
            )}
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-bgsoft rounded-xl px-3 py-2 ml-8"
                    : "prose prose-xs max-w-none"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-t border-line">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Mesaj yazın..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted/50"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-30 transition-colors"
            >
              Gönder
            </button>
          </div>
        </div>

        {/* Sohbet kapalıysa açma butonu */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="h-8 shrink-0 flex items-center justify-center gap-1.5 border-t border-line bg-surface/50 text-[10px] text-muted/50 hover:text-ink transition-colors"
          >
            <PanelBottomOpen size={11} />
            Sohbeti Aç
          </button>
        )}
      </div>
    </div>
  );
}

// ── Yardımcılar ──

function buildTreeFromGitHub(items: Array<{ path: string; type: string }>): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  for (const item of items) {
    const node: TreeNode = {
      name: item.path.split("/").pop() ?? item.path,
      path: item.path,
      type: item.type === "tree" ? "dir" : "file",
    };
    map.set(item.path, node);

    const parts = item.path.split("/");
    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent && parent.type === "dir") {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      }
    }
  }

  // Dizinleri ve dosyaları sırala
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortNodes(n.children));
  };
  sortNodes(root);

  return root;
}

function buildTreeFromGitLab(items: Array<{ path: string; type: string }>): TreeNode[] {
  return buildTreeFromGitHub(items.map((i) => ({ path: i.path, type: i.type === "tree" ? "tree" : "blob" })));
}
