"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  Globe,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  Paperclip,
  Play,
  RefreshCw,
  Search,
  Settings,
  Square,
  Terminal,
  VenetianMask,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import {
  buildTree,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
} from "@/lib/github";
import type { TreeFile, TreeNode } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

/* ─── helpers ─── */

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

const EXT_COLOR: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  py: "text-green-400",
  css: "text-pink-400", scss: "text-pink-400",
  html: "text-orange-400",
  json: "text-yellow-600",
  md: "text-gray-300",
  go: "text-cyan-400",
  rs: "text-orange-500",
};

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust",
  html: "html", css: "css", scss: "scss",
  json: "json", md: "markdown",
  sh: "shell", bash: "shell",
  sql: "sql", yaml: "yaml", yml: "yaml",
  toml: "ini", xml: "xml",
  c: "c", cpp: "cpp", h: "c",
  java: "java", kt: "kotlin",
  rb: "ruby", php: "php", swift: "swift",
};

function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const color = EXT_COLOR[getExt(name)] ?? "text-muted/60";
  return <File size={size} className={`shrink-0 ${color}`} />;
}

function getAllFiles(node: TreeNode): TreeFile[] {
  return [...node.files, ...Object.values(node.dirs).flatMap(getAllFiles)];
}

const CODER_SUGGESTIONS = [
  { icon: "🔍", text: "Bu kodu incele ve iyileştirme öner" },
  { icon: "🐛", text: "Bu hatayı nasıl düzeltebilirim?" },
  { icon: "⚡", text: "Bu fonksiyonu daha verimli yaz" },
  { icon: "✅", text: "Bu kod için unit test yaz" },
];

let coderAbort: AbortController | null = null;

type AttachedFile = { path: string; content: string };
type OpenTab = { path: string; content: string; dirty?: boolean };

/* ── FileTree component ── */
function FileTreeNode({
  node,
  prefix = "",
  onSelect,
  selectedPath,
}: {
  node: TreeNode;
  prefix?: string;
  onSelect: (f: TreeFile) => void;
  selectedPath: string | null;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (name: string) =>
    setCollapsed((p) => ({ ...p, [name]: !p[name] }));

  return (
    <div>
      {Object.entries(node.dirs).map(([name, child]) => {
        const key = prefix + name;
        const isOpen = !collapsed[key];
        return (
          <div key={key}>
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted hover:text-ink hover:bg-bgsoft/50 rounded transition-colors text-left"
              style={{ paddingLeft: `${(prefix.split("/").length) * 8 + 4}px` }}
            >
              {isOpen ? <ChevronDown size={10} className="shrink-0" /> : <ChevronRight size={10} className="shrink-0" />}
              {isOpen ? <FolderOpen size={11} className="shrink-0 text-yellow-500/70" /> : <Folder size={11} className="shrink-0 text-muted/50" />}
              <span className="truncate">{name}</span>
            </button>
            {isOpen && (
              <FileTreeNode
                node={child}
                prefix={key + "/"}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            )}
          </div>
        );
      })}
      {node.files.map((f) => (
        <button
          key={f.path}
          onClick={() => onSelect(f)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors text-left ${
            selectedPath === f.path
              ? "bg-brand/10 text-brand border-l-2 border-brand"
              : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
          }`}
          style={{ paddingLeft: `${(prefix.split("/").length) * 8 + 8}px` }}
        >
          <FileIcon name={f.name} size={11} />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── main component ─── */

export function CoderView() {
  const config = useStore((s) => s.config);
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const pendingInput = useStore((s) => s.pendingInput);
  const followUpSuggestions = useStore((s) => s.followUpSuggestions);

  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const setFollowUpSuggestions = useStore((s) => s.setFollowUpSuggestions);
  const addToast = useStore((s) => s.addToast);

  /* layout state */
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);

  /* editor state */
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<Record<string, string>>({});

  /* terminal */
  const [termLines, setTermLines] = useState<string[]>(["$ craft.ai terminal — hazır"]);
  const [termInput, setTermInput] = useState("");
  const termEndRef = useRef<HTMLDivElement>(null);

  /* AI panel chat */
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [searchOn, setSearchOn] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];

  const activeContent = activeTab ? (editorContent[activeTab] ?? openTabs.find((t) => t.path === activeTab)?.content ?? "") : "";
  const activeTabObj = openTabs.find((t) => t.path === activeTab);

  /* pending input bridge */
  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  /* auto-scroll chat */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  /* auto-scroll terminal */
  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [termLines]);

  /* textarea auto-height */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  /* connect to repo */
  const connectRepo = async () => {
    const store = useStore.getState();
    const parsed = parseRepo(store.config.activeRepo || "");
    if (!parsed) { addToast("Ayarlar'dan bir GitHub deposu ekle.", "error"); return; }
    const token = store.activeGithub()?.token;
    setConnecting(true);
    try {
      const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token);
      setRepo({ ...parsed, branch });
      setTree(buildTree(items));
    } catch (e) {
      addToast(`Depo bağlantısı başarısız: ${(e as Error).message}`, "error");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (config.activeRepo && !tree) connectRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId]);

  /* open file in editor */
  const openFile = async (file: TreeFile) => {
    if (openTabs.find((t) => t.path === file.path)) {
      setActiveTab(file.path);
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const token = useStore.getState().activeGithub()?.token;
      const content = await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      setOpenTabs((prev) => [...prev, { path: file.path, content }]);
      setEditorContent((prev) => ({ ...prev, [file.path]: content }));
      setActiveTab(file.path);
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* attach file to AI context */
  const attachRepoFile = async (file: TreeFile) => {
    if (attachedFiles.find((f) => f.path === file.path)) {
      setAttachedFiles((prev) => prev.filter((f) => f.path !== file.path));
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const token = useStore.getState().activeGithub()?.token;
      const content = await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      setAttachedFiles((prev) => [...prev, { path: file.path, content }]);
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  const closeTab = (path: string) => {
    setOpenTabs((prev) => {
      const rest = prev.filter((t) => t.path !== path);
      if (activeTab === path) setActiveTab(rest[rest.length - 1]?.path ?? null);
      return rest;
    });
  };

  /* local file read */
  const readFileIntoInput = (f: File) => {
    if (f.type.startsWith("image/")) {
      if (f.size > 5_000_000) { addToast("Görsel 5MB'den büyük.", "error"); return; }
      const reader = new FileReader();
      reader.onload = () => setPendingImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
      return;
    }
    if (f.size > 512_000) { addToast("Dosya 512KB'den büyük.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const ext = f.name.split(".").pop() || "";
      setInput((prev) => prev + (prev ? "\n\n" : "") + `\`${f.name}\`:\n\`\`\`${ext}\n${reader.result as string}\n\`\`\``);
      taRef.current?.focus();
    };
    reader.readAsText(f);
    /* also open in editor if code file */
    if (!f.type.startsWith("image/")) {
      const reader2 = new FileReader();
      reader2.onload = () => {
        const content = reader2.result as string;
        setOpenTabs((prev) => {
          if (prev.find((t) => t.path === f.name)) return prev;
          return [...prev, { path: f.name, content }];
        });
        setEditorContent((prev) => ({ ...prev, [f.name]: content }));
        setActiveTab(f.name);
      };
      reader2.readAsText(f);
    }
  };

  /* terminal command handler */
  const runTerminalCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    setTermLines((prev) => [...prev, `$ ${trimmed}`]);
    if (!trimmed) return;
    if (trimmed === "clear") { setTermLines(["$ craft.ai terminal — hazır"]); return; }
    if (trimmed === "help") {
      setTermLines((prev) => [...prev, "Komutlar: clear, help, ls, pwd, echo <text>"]);
      return;
    }
    if (trimmed === "pwd") { setTermLines((prev) => [...prev, "/workspace"]); return; }
    if (trimmed === "ls") {
      const files = openTabs.map((t) => t.path.split("/").pop()).join("  ");
      setTermLines((prev) => [...prev, files || "(boş)"]);
      return;
    }
    if (trimmed.startsWith("echo ")) {
      setTermLines((prev) => [...prev, trimmed.slice(5)]);
      return;
    }
    setTermLines((prev) => [...prev, `komut bulunamadı: ${trimmed.split(" ")[0]}`]);
  };

  /* API call */
  const fetchFollowUps = useCallback(async () => {
    const store = useStore.getState();
    if (!store.config.followUps) return;
    const active = store.activeModel();
    if (!active) return;
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey,
        }),
      });
      const { suggestions } = await res.json();
      store.setFollowUpSuggestions(suggestions || []);
    } catch { /* yoksay */ }
  }, []);

  const callApi = useCallback(async () => {
    const store = useStore.getState();
    const active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }

    const apiMessages = (store.current()?.messages ?? []).map((m) => {
      if (m.images?.length) {
        const content: unknown[] = m.images.map((img) => ({ type: "image_url", image_url: { url: img } }));
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    const coderSystemPrompt = [
      config.systemPrompt,
      "Sen uzman bir yazılım geliştiricisisin. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun. Hata ayıklarken adım adım düşün.",
    ].filter(Boolean).join("\n\n");

    store.pushMessage({ role: "assistant", content: "" });
    store.setStreaming(true);
    store.setFollowUpSuggestions([]);
    coderAbort = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: coderAbort.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey,
          provider: active.provider, systemPrompt: coderSystemPrompt,
          style: store.config.style, memories: store.config.memories,
        }),
      });

      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; useStore.getState().updateLastContent(full); }
          } catch { /* parçalı satır */ }
        }
      }
      if (!full) useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        useStore.getState().updateLastContent(`**Hata:** ${(err as Error).message}\n\n_Anahtar/model doğru mu? Ayarlardan kontrol et._`);
      }
    } finally {
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      fetchFollowUps();
    }
  }, [config.systemPrompt, fetchFollowUps]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    if (!store.currentId) store.newChat(incognito);

    let fullText = text;
    if (attachedFiles.length > 0) {
      const ctx = attachedFiles
        .map((f) => `\`${f.path}\`:\n\`\`\`${getExt(f.path)}\n${f.content.slice(0, 10000)}\n\`\`\``)
        .join("\n\n");
      fullText = ctx + (text ? "\n\n" + text : "");
    }
    /* also attach current editor content if any */
    if (activeTab && editorContent[activeTab] && !attachedFiles.find((f) => f.path === activeTab)) {
      fullText = `\`${activeTab}\`:\n\`\`\`${getExt(activeTab)}\n${editorContent[activeTab].slice(0, 8000)}\n\`\`\`` + (fullText ? "\n\n" + fullText : "");
    }

    store.pushMessage({ role: "user", content: fullText, images: pendingImages.length ? [...pendingImages] : undefined });
    store.maybeSetTitle(text || attachedFiles[0]?.path || "Dosya analizi");
    setInput("");
    setPendingImages([]);
    setAttachedFiles([]);
    await callApi();
  };

  const stop = () => { coderAbort?.abort(); coderAbort = null; };

  const regenerate = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    if (chat.messages[chat.messages.length - 1].role === "assistant") store.popLastMessage();
    await callApi();
  };

  const editAndResend = async (index: number, content: string) => {
    const store = useStore.getState();
    store.editMessageAt(index, content);
    store.truncateAfter(index);
    await callApi();
  };

  const allFiles = tree ? getAllFiles(tree) : [];
  const filteredFiles = repoSearch
    ? allFiles.filter((f) => f.name.toLowerCase().includes(repoSearch.toLowerCase()) || f.path.toLowerCase().includes(repoSearch.toLowerCase()))
    : allFiles;

  const editorTheme = config.theme === "light" ? "light" : "vs-dark";
  const editorLang = activeTab ? (LANG_MAP[getExt(activeTab)] ?? "plaintext") : "plaintext";

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">

      {/* ── Header ── */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line/60 bg-surface/80 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          title="Yan panel (Ctrl+B)"
          className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors shrink-0 md:hidden"
        >
          <PanelLeft size={16} />
        </button>

        <button
          onClick={() => setFileTreeOpen((v) => !v)}
          title="Dosya ağacı"
          className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${fileTreeOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
        >
          <FolderOpen size={15} />
        </button>

        {/* Tabs */}
        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto min-w-0 scrollbar-none">
          {openTabs.length === 0 && (
            <span className="text-xs text-muted/40 px-2">Dosya aç veya yükle</span>
          )}
          {openTabs.map((tab) => (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              className={`group/tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono cursor-pointer shrink-0 transition-colors ${
                activeTab === tab.path
                  ? "bg-bgsoft border border-line/60 text-ink"
                  : "text-muted/60 hover:text-ink hover:bg-bgsoft/50"
              }`}
            >
              <FileIcon name={tab.path.split("/").pop() ?? ""} size={10} />
              <span>{tab.path.split("/").pop()}</span>
              {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}
                className="opacity-0 group-hover/tab:opacity-100 hover:text-red transition-all ml-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {config.models.length > 0 ? (
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
              <span className="hidden sm:inline truncate max-w-[120px] font-medium">
                {config.models.find((m) => m.id === config.activeModelId)?.label ||
                  config.models.find((m) => m.id === config.activeModelId)?.model || "Model seç"}
              </span>
            </button>
          ) : (
            <button onClick={() => setSettingsOpen(true)} className="text-xs px-2 py-1 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors">
              + Model
            </button>
          )}
          <button
            onClick={() => setAiPanelOpen((v) => !v)}
            title="AI Panel"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${aiPanelOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <PanelRight size={15} />
          </button>
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            title="Terminal"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${terminalOpen ? "text-green bg-green/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <Terminal size={14} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors"
            title="Ayarlar"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* File tree */}
        {fileTreeOpen && (
          <div className="w-48 shrink-0 flex flex-col border-r border-line/60 bg-surface/40 overflow-hidden">
            <div className="px-3 py-2 border-b border-line/40 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50">
                {repo ? `${repo.owner}/${repo.repo}` : "Dosyalar"}
              </span>
              {repo && (
                <button onClick={connectRepo} disabled={connecting} title="Yenile" className="text-muted/50 hover:text-brand transition-colors">
                  <RefreshCw size={10} className={connecting ? "animate-spin" : ""} />
                </button>
              )}
            </div>

            {/* file search */}
            {tree && (
              <div className="px-2 py-1.5 border-b border-line/40">
                <div className="relative">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Dosya ara…"
                    className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {!tree ? (
                <div className="px-3 py-4 text-center">
                  <FolderGit2 size={22} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-[10px] text-muted/40 leading-relaxed mb-2">
                    {connecting ? "Yükleniyor…" : "Repo bağla"}
                  </p>
                  {!connecting && (
                    <button onClick={() => setSettingsOpen(true)} className="text-[10px] px-2 py-1 rounded-lg bg-brand/10 border border-brand/25 text-brand font-medium hover:bg-brand/20 transition-colors">
                      Ayarlar
                    </button>
                  )}
                </div>
              ) : repoSearch ? (
                <div className="py-1">
                  {filteredFiles.slice(0, 50).map((f) => (
                    <button
                      key={f.path}
                      onClick={() => openFile(f)}
                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-left rounded transition-colors ${
                        activeTab === f.path ? "bg-brand/10 text-brand" : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
                      }`}
                    >
                      {fetchingFile === f.path ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" /> : <FileIcon name={f.name} size={10} />}
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <FileTreeNode node={tree} onSelect={openFile} selectedPath={activeTab} />
              )}
            </div>

            {/* upload local */}
            <div className="px-2 py-2 border-t border-line/40">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-line/60 hover:border-brand/40 text-[11px] text-muted hover:text-ink transition-colors"
              >
                <Paperclip size={11} /> Dosya yükle
              </button>
            </div>
          </div>
        )}

        {/* Editor + terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {/* Monaco editor */}
          <div className={`flex-1 min-h-0 ${terminalOpen ? "h-0" : ""}`} style={{ minHeight: terminalOpen ? "40%" : undefined }}>
            {openTabs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-brand/8 border border-brand/15 grid place-items-center mx-auto mb-5">
                  <Code2 size={24} className="text-brand/60" />
                </div>
                <p className="text-sm font-semibold text-ink/70 mb-1.5">Editör</p>
                <p className="text-xs text-muted/50 leading-relaxed max-w-xs">
                  Sol panelden bir dosya seç veya yerel dosya yükle. AI panelinden kod analizi yapabilirsin.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-left w-full max-w-xs">
                  {CODER_SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => { setInput(s.text); setAiPanelOpen(true); }}
                      className="flex items-start gap-2 p-3 rounded-xl border border-line bg-surface hover:border-brand/40 text-xs transition-all"
                    >
                      <span className="shrink-0">{s.icon}</span>
                      <span className="text-muted leading-snug">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language={editorLang}
                theme={editorTheme}
                value={activeContent}
                onChange={(val) => {
                  if (!activeTab) return;
                  const v = val ?? "";
                  setEditorContent((prev) => ({ ...prev, [activeTab]: v }));
                  setOpenTabs((prev) => prev.map((t) => t.path === activeTab ? { ...t, dirty: true } : t));
                }}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  renderLineHighlight: "gutter",
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  padding: { top: 12, bottom: 12 },
                  wordWrap: "on",
                  bracketPairColorization: { enabled: true },
                  formatOnPaste: true,
                  tabSize: 2,
                }}
              />
            )}
          </div>

          {/* Terminal */}
          {terminalOpen && (
            <div className="h-44 shrink-0 flex flex-col border-t border-line/60 bg-[#0d0d10]">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-line/40">
                <div className="flex items-center gap-2">
                  <Terminal size={12} className="text-green" />
                  <span className="text-[11px] text-muted/60 font-mono">Terminal</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setTermLines(["$ craft.ai terminal — hazır"])} className="text-[10px] text-muted/40 hover:text-muted px-2 py-0.5 rounded transition-colors">Temizle</button>
                  <button onClick={() => setTerminalOpen(false)} className="text-muted/40 hover:text-muted p-0.5 rounded transition-colors"><X size={11} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
                {termLines.map((line, i) => (
                  <div key={i} className={`leading-relaxed ${line.startsWith("$") ? "text-green/80" : "text-muted/70"}`}>{line}</div>
                ))}
                <div ref={termEndRef} />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line/40">
                <span className="text-green/70 font-mono text-[12px]">$</span>
                <input
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { runTerminalCommand(termInput); setTermInput(""); }
                  }}
                  className="flex-1 bg-transparent outline-none font-mono text-[12px] text-muted/90 placeholder:text-muted/30"
                  placeholder="komut gir…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* AI Panel */}
        {aiPanelOpen && (
          <div className="w-80 shrink-0 flex flex-col border-l border-line/60 bg-surface/30 min-h-0 overflow-hidden">
            <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-line/40">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md brand-gradient grid place-items-center text-white text-[10px]">✦</div>
                <span className="text-xs font-semibold">AI Asistan</span>
              </div>
              <div className="flex items-center gap-1">
                {incognito && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple/10 text-purple border border-purple/30">
                    <VenetianMask size={9} /> Gizli
                  </span>
                )}
                <button onClick={() => setAiPanelOpen(false)} className="text-muted/40 hover:text-muted p-0.5 rounded transition-colors">
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
              {messages.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[11px] text-muted/50 leading-relaxed">
                    {activeTab
                      ? `${activeTab.split("/").pop()} açık — sorun hakkında sorabilirsin`
                      : "Bir dosya aç ve AI ile analiz et"}
                  </p>
                  <div className="mt-4 space-y-1.5">
                    {CODER_SUGGESTIONS.map((s) => (
                      <button
                        key={s.text}
                        onClick={() => setInput(s.text)}
                        className="w-full text-left flex items-start gap-2 p-2.5 rounded-xl border border-line bg-surface hover:border-brand/40 text-[11px] transition-all"
                      >
                        <span>{s.icon}</span>
                        <span className="text-muted leading-snug">{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m, i) => {
                    const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                    return (
                      <MessageBubble
                        key={i}
                        index={i}
                        message={m}
                        showRegenerate={isLastAssistant && !streaming}
                        onRegenerate={regenerate}
                        onEdit={m.role === "user" ? editAndResend : undefined}
                      />
                    );
                  })}
                  {streaming && messages[messages.length - 1]?.content === "" && (
                    <div className="flex gap-2 py-2">
                      <div className="shrink-0 w-6 h-6 rounded-md brand-gradient grid place-items-center text-white text-[10px]">✦</div>
                      <div className="flex items-center gap-1 pt-1.5">
                        <span className="typing-dot" />
                        <span className="typing-dot delay-1" />
                        <span className="typing-dot delay-2" />
                      </div>
                    </div>
                  )}
                  {!streaming && followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {followUpSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s); setFollowUpSuggestions([]); }}
                          className="text-[10px] px-2 py-1 rounded-full border border-line bg-surface hover:border-brand/50 transition-colors text-muted hover:text-ink"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Attached files */}
            {attachedFiles.length > 0 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {attachedFiles.map((f) => (
                  <div key={f.path} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-brand/10 border border-brand/25 text-brand">
                    <FileIcon name={f.path.split("/").pop() ?? ""} size={9} />
                    <span className="max-w-[100px] truncate font-mono">{f.path.split("/").pop()}</span>
                    <button onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.path !== f.path))} className="text-brand/50 hover:text-red transition-colors">
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Composer */}
            <div className="px-3 pb-3 shrink-0">
              {pendingImages.length > 0 && (
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group/img">
                      <img src={img} alt="" className="w-12 h-12 object-cover rounded-lg border border-line" />
                      <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red text-white grid place-items-center text-[9px] opacity-0 group-hover/img:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1.5 bg-surface border border-line rounded-xl px-2.5 py-2 focus-within:border-brand/50 transition-colors">
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => fileRef.current?.click()} title="Dosya" className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft transition-colors">
                    <Paperclip size={13} />
                  </button>
                  <button onClick={() => imgRef.current?.click()} title="Görsel" className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft transition-colors">
                    <ImageIcon size={13} />
                  </button>
                  <button onClick={() => setSearchOn(!searchOn)} title="Web" className={`p-1 rounded-lg transition-colors ${searchOn ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}>
                    <Globe size={13} />
                  </button>
                  <button onClick={() => useStore.getState().setPromptLibraryOpen(true)} title="Şablonlar" className="text-muted hover:text-ink p-1 rounded-lg hover:bg-bgsoft transition-colors">
                    <BookOpen size={13} />
                  </button>
                </div>

                <input ref={fileRef} type="file" accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />
                <input ref={imgRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />

                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="AI'ya sor…"
                  className="flex-1 bg-transparent resize-none outline-none text-[13px] leading-relaxed max-h-[120px] py-1 placeholder:text-muted/40"
                />

                {streaming ? (
                  <button onClick={stop} className="shrink-0 w-7 h-7 rounded-lg bg-red hover:bg-red/80 text-white grid place-items-center transition-colors">
                    <Square size={11} />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                    className="shrink-0 w-7 h-7 rounded-lg bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
