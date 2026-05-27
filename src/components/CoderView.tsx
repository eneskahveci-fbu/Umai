"use client";

import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  buildTree,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
} from "@/lib/github";
import type { OpenFile, TreeFile, TreeNode } from "@/lib/types";

const EXT_COLORS: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  py: "text-green-400",
  css: "text-pink-400", scss: "text-pink-400", sass: "text-pink-400",
  html: "text-orange-400",
  json: "text-yellow-600",
  md: "text-gray-300",
  go: "text-cyan-400",
  rs: "text-orange-500",
  java: "text-red-400",
  rb: "text-red-500",
  php: "text-purple-400",
  sh: "text-green-600",
  yml: "text-yellow-600", yaml: "text-yellow-600",
  toml: "text-orange-300",
  sql: "text-blue-300",
};

const LANG_LABELS: Record<string, string> = {
  ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
  py: "Python", css: "CSS", scss: "SCSS", sass: "Sass",
  html: "HTML", json: "JSON", md: "Markdown", go: "Go",
  rs: "Rust", java: "Java", rb: "Ruby", php: "PHP",
  sh: "Shell", yml: "YAML", yaml: "YAML", toml: "TOML",
  sql: "SQL", c: "C", cpp: "C++", cs: "C#",
};

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function FileIcon({ name, size = 12 }: { name: string; size?: number }) {
  const ext = getExt(name);
  const color = EXT_COLORS[ext] ?? "text-muted/60";
  return <File size={size} className={`shrink-0 ${color}`} />;
}

function LangBadge({ path }: { path: string }) {
  const ext = getExt(path.split("/").pop() ?? path);
  const label = LANG_LABELS[ext];
  if (!label) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bgsoft border border-line/60 text-muted/60 font-mono shrink-0">
      {label}
    </span>
  );
}

const ERROR_MAP: Record<string, string> = {
  "Failed to fetch": "Bağlantı kurulamadı.",
  "Not Found": "Depo bulunamadı.",
};

function turkishError(msg: string) {
  return ERROR_MAP[msg] || msg.replace("rate limit", "istek limiti");
}

export function CoderView() {
  const config = useStore((s) => s.config);
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setCurrentFile = useStore((s) => s.setCurrentFile);
  const addToast = useStore((s) => s.addToast);

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  /* tabs */
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const activeFile = tabs.find((t) => t.path === activeTab) ?? null;

  /* file tree search */
  const [treeSearch, setTreeSearch] = useState("");

  /* AI panel */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ q: string; a: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  /* ── repo connect ── */
  const connect = async () => {
    const store = useStore.getState();
    const parsed = parseRepo(store.config.activeRepo || "");
    if (!parsed) { setError("Geçerli bir depo seç (kullanici/depo)."); return; }
    const token = store.activeGithub()?.token;
    setConnecting(true);
    setError(null);
    try {
      const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token);
      setRepo({ ...parsed, branch });
      setTree(buildTree(items));
    } catch (e) {
      setError(turkishError((e as Error).message));
      setTree(null);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (config.activeRepo) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId]);

  /* ── open file / tabs ── */
  const openFile = async (path: string) => {
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActiveTab(path);
      setCurrentFile(existing);
      return;
    }
    if (!repo) return;
    setLoadingFile(true);
    try {
      const token = useStore.getState().activeGithub()?.token;
      const content = await fetchFileContent(repo.owner, repo.repo, repo.branch, path, token);
      const file: OpenFile = { path, content };
      setTabs((prev) => [...prev, file]);
      setActiveTab(path);
      setCurrentFile(file);
    } catch (e) {
      addToast(`Dosya açılamadı: ${turkishError((e as Error).message)}`, "error");
    } finally {
      setLoadingFile(false);
    }
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter((t) => t.path !== path);
    setTabs(newTabs);
    if (activeTab === path) {
      const newActive = newTabs[newTabs.length - 1]?.path ?? null;
      setActiveTab(newActive);
      setCurrentFile(newTabs.find((t) => t.path === newActive) ?? null);
    }
  };

  /* ── actions ── */
  const sendToChat = () => {
    if (!activeFile) return;
    const ext = getExt(activeFile.path);
    const msg = `Şu dosyaya bakar mısın — \`${activeFile.path}\`:\n\n\`\`\`${ext}\n${activeFile.content}\n\`\`\`\n\nBu dosyayı açıkla / iyileştirme öner.`;
    const store = useStore.getState();
    if (!store.currentId) store.newChat(false);
    store.setPendingInput(msg);
    store.setView("chat");
  };

  const copyFile = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    addToast("Kopyalandı", "info");
  };

  /* ── AI panel ── */
  const askAI = async () => {
    const q = aiInput.trim();
    if (!q || aiStreaming) return;
    const model = useStore.getState().activeModel();
    if (!model) { addToast("Önce Ayarlar'dan bir model ekle.", "error"); return; }

    setAiInput("");
    setAiStreaming(true);
    setAiMessages((prev) => [...prev, { q, a: "" }]);

    const fileCtx = activeFile
      ? `Mevcut dosya: \`${activeFile.path}\`\n\`\`\`\n${activeFile.content.slice(0, 12000)}\n\`\`\`\n\n`
      : "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: fileCtx + q }],
          model,
          systemPrompt: "Sen deneyimli bir yazılım geliştiricisin. Kısa, net ve teknik cevaplar ver.",
        }),
      });
      if (!res.ok || !res.body) throw new Error("API hatası");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6);
          if (d === "[DONE]") break;
          try { const { content } = JSON.parse(d); if (content) full += content; } catch {}
        }
        setAiMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { q, a: full };
          return updated;
        });
      }
    } catch (e) {
      setAiMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { q, a: `Hata: ${(e as Error).message}` };
        return updated;
      });
    } finally {
      setAiStreaming(false);
      setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-line bg-surface/50">
        <Code2 size={17} className="text-brand shrink-0" />
        {repo ? (
          <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
            <span className="font-semibold text-ink truncate">
              {repo.owner}<span className="text-muted/50">/</span>{repo.repo}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-cyan/10 text-cyan font-mono border border-cyan/20">
              {repo.branch}
            </span>
            {tabs.length > 0 && (
              <span className="text-[11px] text-muted/50">
                {tabs.length} dosya açık
              </span>
            )}
          </div>
        ) : (
          <span className="flex-1 text-sm text-muted/60 italic">Depo bağlı değil — Ayarlar&apos;dan GitHub deposu ekle</span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAiOpen((o) => !o)}
            title="AI Asistan aç/kapat"
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors ${
              aiOpen
                ? "bg-brand/10 border-brand/40 text-brand"
                : "border-line/60 text-muted hover:text-ink hover:border-line"
            }`}
          >
            <Bot size={14} />
            AI Asistan
          </button>
          <button
            onClick={connect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-brand hover:bg-branddim text-white font-semibold disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={connecting ? "animate-spin" : ""} />
            {connecting ? "Bağlanıyor…" : "Bağlan"}
          </button>
        </div>
      </div>

      {/* ── Body: tree + code + AI ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── File tree ── */}
        <div className="w-52 shrink-0 border-r border-line flex flex-col min-h-0 bg-bgsoft/20">
          <div className="p-2 border-b border-line/50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40" />
              <input
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="Dosya ara..."
                className="w-full bg-bgsoft/70 rounded-lg pl-7 pr-2 py-1.5 text-xs outline-none focus:ring-1 ring-brand/40 placeholder:text-muted/35 transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {error ? (
              <div className="text-center py-8 px-3">
                <FolderGit2 size={24} className="mx-auto mb-2 text-red/50" />
                <p className="text-xs text-red/80 leading-relaxed">{error}</p>
                <button onClick={connect} className="mt-3 text-xs text-brand hover:text-branddim font-semibold">
                  Tekrar dene
                </button>
              </div>
            ) : !tree ? (
              <div className="text-center py-8 px-3">
                <FolderGit2 size={24} className="mx-auto mb-2 text-muted/25" />
                <p className="text-xs text-muted/50 leading-relaxed">
                  {connecting ? "Yükleniyor…" : "Ayarlar → GitHub'dan depo ekle"}
                </p>
              </div>
            ) : treeSearch ? (
              <FlatSearch
                node={tree}
                filter={treeSearch}
                activePath={activeTab}
                onOpen={openFile}
              />
            ) : (
              <TreeDir
                node={tree}
                root
                activePath={activeTab}
                onOpen={openFile}
              />
            )}
          </div>
        </div>

        {/* ── Code panel ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Tabs bar */}
          <div className="shrink-0 flex items-center border-b border-line bg-bgsoft/10 overflow-x-auto scrollbar-thin min-h-[36px]">
            {tabs.length === 0 ? (
              <span className="text-xs text-muted/35 px-4 py-2 italic">Dosya seçilmedi</span>
            ) : (
              tabs.map((tab) => {
                const name = tab.path.split("/").pop() ?? tab.path;
                const isActive = tab.path === activeTab;
                return (
                  <button
                    key={tab.path}
                    onClick={() => { setActiveTab(tab.path); setCurrentFile(tab); }}
                    title={tab.path}
                    className={`group/tab flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-r border-line/50 transition-colors ${
                      isActive
                        ? "bg-bg text-ink border-t-2 border-t-brand"
                        : "text-muted hover:text-ink hover:bg-bgsoft/50"
                    }`}
                  >
                    <FileIcon name={name} size={11} />
                    {name}
                    <span
                      onClick={(e) => closeTab(tab.path, e)}
                      className="opacity-0 group-hover/tab:opacity-100 hover:bg-line/60 rounded p-0.5 transition-opacity ml-0.5"
                    >
                      <X size={9} />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* File info bar + code */}
          {activeFile ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-line/40 bg-bgsoft/10">
                {/* Breadcrumb */}
                <div className="flex items-center gap-0.5 text-xs text-muted/60 min-w-0 flex-1">
                  {activeFile.path.split("/").map((part, i, arr) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <ChevronRight size={10} className="text-muted/25 shrink-0" />}
                      <span className={i === arr.length - 1 ? "text-ink/90 font-medium" : ""}>{part}</span>
                    </span>
                  ))}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <LangBadge path={activeFile.path} />
                  <span className="text-[11px] text-muted/40">
                    {activeFile.content.split("\n").length} satır
                  </span>
                  <button
                    onClick={copyFile}
                    title="İçeriği kopyala"
                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={sendToChat}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-brand font-semibold hover:bg-brand/20 transition-colors"
                  >
                    <MessageSquarePlus size={13} />
                    Sohbete gönder
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {loadingFile ? (
                  <div className="h-full grid place-items-center">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <RefreshCw size={15} className="animate-spin" /> Yükleniyor…
                    </div>
                  </div>
                ) : (
                  <CodeView path={activeFile.path} content={activeFile.content} />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 grid place-items-center">
              <div className="text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-brand/5 border border-brand/10 grid place-items-center mx-auto mb-4">
                  <FolderGit2 size={28} className="text-muted/25" />
                </div>
                <p className="text-sm text-muted/50 font-medium mb-1">Dosya seçilmedi</p>
                <p className="text-xs text-muted/30 leading-relaxed">
                  Sol panelden bir dosyaya tıkla.<br />
                  Birden fazla dosyayı sekmelerle takip edebilirsin.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── AI Panel ── */}
        {aiOpen && (
          <div className="w-80 shrink-0 border-l border-line flex flex-col min-h-0 bg-bgsoft/10">
            {/* AI header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-line bg-surface/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-brand/15 border border-brand/25 grid place-items-center">
                  <Bot size={14} className="text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">AI Asistan</p>
                  <p className="text-[10px] text-muted/60 mt-0.5">Kod hakkında sor</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {aiMessages.length > 0 && (
                  <button
                    onClick={() => setAiMessages([])}
                    className="text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft transition-colors"
                  >
                    Temizle
                  </button>
                )}
                <button
                  onClick={() => setAiOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Context chip */}
            {activeFile && (
              <div className="shrink-0 mx-3 mt-3 mb-0 px-3 py-2 rounded-xl bg-brand/5 border border-brand/15 flex items-center gap-2">
                <FileIcon name={activeFile.path.split("/").pop() ?? ""} size={12} />
                <span className="text-[11px] text-muted/70 font-mono truncate flex-1">
                  {activeFile.path.split("/").pop()}
                </span>
                <LangBadge path={activeFile.path} />
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
              {aiMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot size={32} className="mx-auto mb-3 text-muted/15" />
                  <p className="text-xs text-muted/40 leading-relaxed">
                    {activeFile
                      ? `"${activeFile.path.split("/").pop()}" dosyası hakkında\nsoru sorabilirsin`
                      : "Bir dosya aç ve soru sor"}
                  </p>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-brand/20 grid place-items-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-brand">S</span>
                    </div>
                    <div className="bg-bgsoft rounded-xl px-3 py-2 text-xs text-ink leading-relaxed flex-1">
                      {msg.q}
                    </div>
                  </div>
                  {msg.a && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-brand grid place-items-center shrink-0 mt-0.5">
                        <Bot size={10} className="text-white" />
                      </div>
                      <div className="text-xs text-muted/90 leading-relaxed whitespace-pre-wrap flex-1 pt-1">
                        {msg.a}
                        {aiStreaming && i === aiMessages.length - 1 && (
                          <span className="inline-block w-1 h-3 bg-brand ml-0.5 animate-pulse rounded-sm" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={aiEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 p-3 border-t border-line">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={aiInputRef}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(); }
                  }}
                  placeholder={activeFile ? "Dosya hakkında sor… (Enter)" : "Bir dosya aç…"}
                  rows={2}
                  className="flex-1 bg-bgsoft border border-line/60 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand/50 resize-none placeholder:text-muted/35 transition-colors"
                />
                <button
                  onClick={askAI}
                  disabled={aiStreaming || !aiInput.trim()}
                  className="w-9 h-9 rounded-xl bg-brand hover:bg-branddim disabled:opacity-40 text-white grid place-items-center transition-colors shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Code view with line numbers ── */
function CodeView({ path, content }: { path: string; content: string }) {
  const ext = getExt(path.split("/").pop() ?? path);
  let html: string;
  try {
    html = hljs.getLanguage(ext)
      ? hljs.highlight(content, { language: ext }).value
      : hljs.highlightAuto(content).value;
  } catch {
    html = content.replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string,
    );
  }
  const lineCount = content.split("\n").length;
  return (
    <div className="flex text-[13px] font-mono leading-relaxed py-4 min-h-full">
      {/* Line numbers */}
      <div
        className="select-none text-right pr-4 pl-3 text-muted/25 border-r border-line/20 shrink-0"
        style={{ minWidth: `${String(lineCount).length * 0.6 + 2.5}rem` }}
        aria-hidden
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-relaxed">{i + 1}</div>
        ))}
      </div>
      {/* Highlighted code */}
      <pre className="flex-1 overflow-x-auto px-4 pb-8">
        <code
          className="hljs bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}

/* ── Tree directory (with fold/unfold) ── */
function TreeDir({
  node, root, activePath, onOpen,
}: {
  node: TreeNode; root?: boolean; activePath: string | null; onOpen: (path: string) => void;
}) {
  const dirs = Object.keys(node.dirs).sort();
  const files = node.files.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={root ? "" : "ml-2 border-l border-line/25 pl-1"}>
      {dirs.map((name) => (
        <TreeDirItem key={name} name={name} node={node.dirs[name]} activePath={activePath} onOpen={onOpen} />
      ))}
      {files.map((f) => (
        <TreeFileBtn key={f.path} file={f} activePath={activePath} onOpen={onOpen} />
      ))}
    </div>
  );
}

function TreeDirItem({
  name, node, activePath, onOpen,
}: {
  name: string; node: TreeNode; activePath: string | null; onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-muted hover:text-ink hover:bg-bgsoft/60 transition-colors text-left"
      >
        {open
          ? <FolderOpen size={12} className="shrink-0 text-yellow-500/70" />
          : <Folder size={12} className="shrink-0 text-muted/50" />}
        <span className="truncate font-medium">{name}</span>
        <ChevronDown size={10} className={`ml-auto shrink-0 text-muted/30 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <TreeDir node={node} activePath={activePath} onOpen={onOpen} />
      )}
    </div>
  );
}

function TreeFileBtn({
  file, activePath, onOpen,
}: {
  file: TreeFile; activePath: string | null; onOpen: (path: string) => void;
}) {
  const isActive = activePath === file.path;
  return (
    <button
      onClick={() => onOpen(file.path)}
      title={file.path}
      className={`w-full flex items-center gap-1.5 px-2 py-1 pl-3 rounded-lg text-xs transition-colors text-left ${
        isActive
          ? "bg-brand/12 text-brand border border-brand/20"
          : "text-muted/80 hover:bg-bgsoft/60 hover:text-ink"
      }`}
    >
      <FileIcon name={file.name} />
      <span className="truncate">{file.name}</span>
    </button>
  );
}

/* ── Flat search results ── */
function getAllFiles(node: TreeNode): TreeFile[] {
  return [
    ...node.files,
    ...Object.values(node.dirs).flatMap(getAllFiles),
  ];
}

function FlatSearch({
  node, filter, activePath, onOpen,
}: {
  node: TreeNode; filter: string; activePath: string | null; onOpen: (path: string) => void;
}) {
  const lower = filter.toLowerCase();
  const results = getAllFiles(node).filter((f) =>
    f.name.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower),
  );
  if (results.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-muted/40">Eşleşme yok</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] text-muted/40 px-2 py-1">{results.length} sonuç</p>
      {results.map((f) => (
        <TreeFileBtn key={f.path} file={f} activePath={activePath} onOpen={onOpen} />
      ))}
    </div>
  );
}
