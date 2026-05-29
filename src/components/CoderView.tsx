"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  BookmarkPlus,
  Brain,
  ChevronDown,
  GitBranch,
  ChevronRight,
  Code2,
  DollarSign,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  Globe,
  Image as ImageIcon,
  Mic,
  Palette,
  PanelLeft,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Terminal,
  VenetianMask,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { detectLanguage, type EditorFile } from "@/lib/editor";

const EditorPanel = dynamic(
  () => import("./EditorPanel").then((m) => m.EditorPanel),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col h-full bg-[#0e0e13] border-l border-line/60"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-line/60 shrink-0 bg-surface">
          <div className="h-4 flex-1 rounded bg-bgsoft animate-pulse" aria-hidden="true" />
        </div>
        <div className="flex-1 grid place-items-center">
          <div className="flex items-center gap-1.5">
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot delay-1" aria-hidden="true" />
            <span className="typing-dot delay-2" aria-hidden="true" />
          </div>
        </div>
        <span className="sr-only">Editör yükleniyor…</span>
      </div>
    ),
  },
);
import { GitPanel } from "./GitPanel";
import { ArtifactPanel } from "./ArtifactPanel";
import { MultiCommitBar } from "./MultiCommitBar";

const RealTerminal = dynamic(() => import("./RealTerminal").then((m) => m.RealTerminal), {
  ssr: false,
  loading: () => (
    <div className="h-64 shrink-0 border-t border-line/60 bg-[#0a0a0d] grid place-items-center">
      <div className="text-xs text-muted/50">Terminal yükleniyor…</div>
    </div>
  ),
});
import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import { SlashMenu } from "./SlashMenu";
import { MentionMenu } from "./MentionMenu";
import {
  buildTree,
  fetchAllFiles,
  fetchFileContent,
  fetchRepoTree,
  parseRepo,
} from "@/lib/github";
import type { TreeFile, TreeNode } from "@/lib/types";
import { AGENTS, findAgentByCommand, stripCommand, type Agent } from "@/lib/agents";
import { calculateCost, estimateTokens, formatCost, getModelPrice } from "@/lib/pricing";

declare global {
  interface SpeechRecognition {
    lang: string; continuous: boolean; interimResults: boolean;
    onresult: (e: SpeechRecognitionEvent) => void;
    onerror: () => void; onend: () => void; start: () => void;
  }
  interface SpeechRecognitionEvent {
    results: { 0: { 0: { transcript: string } } };
  }
}

/* ─── helpers ─── */

function ComposerButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors ${
        active
          ? "text-brand bg-brand/10"
          : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      {children}
    </button>
  );
}

function ThinkingModeToggle() {
  const thinkingMode = useStore((s) => s.thinkingMode);
  const setThinkingMode = useStore((s) => s.setThinkingMode);

  const cycle = () =>
    setThinkingMode(thinkingMode === "fast" ? "pro" : "fast");

  return (
    <button
      onClick={cycle}
      title={`Düşünce modu: ${thinkingMode === "pro" ? "Pro" : "Hızlı"} — tıkla değiştir`}
      className={`flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors font-semibold ${
        thinkingMode === "pro"
          ? "text-brand bg-brand/10"
          : "text-amber-400 bg-amber-400/10"
      }`}
    >
      {thinkingMode === "pro" ? <Brain size={13} /> : <Zap size={13} />}
      <span>{thinkingMode === "pro" ? "Pro Düşünce" : "Hızlı Düşünce"}</span>
    </button>
  );
}

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

/* ── FileTree ── */
function FileTreeNode({
  node, prefix = "", onSelect, attached,
}: {
  node: TreeNode; prefix?: string; onSelect: (f: TreeFile) => void; attached: string[];
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setCollapsed((p) => ({ ...p, [name]: !p[name] }));

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
            {isOpen && <FileTreeNode node={child} prefix={key + "/"} onSelect={onSelect} attached={attached} />}
          </div>
        );
      })}
      {node.files.map((f) => {
        const isAttached = attached.includes(f.path);
        return (
          <button
            key={f.path}
            onClick={() => onSelect(f)}
            className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors text-left ${
              isAttached
                ? "bg-brand/10 text-brand"
                : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
            }`}
            style={{ paddingLeft: `${(prefix.split("/").length) * 8 + 8}px` }}
          >
            <FileIcon name={f.name} size={11} />
            <span className="truncate flex-1">{f.name}</span>
            {isAttached && <span className="text-[9px] font-bold">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── main ─── */

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

  const toolsEnabledStore = useStore((s) => s.toolsEnabled);
  const artifact = useStore((s) => s.artifact);
  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const setFollowUpSuggestions = useStore((s) => s.setFollowUpSuggestions);
  const addToast = useStore((s) => s.addToast);

  const toolsEnabled = toolsEnabledStore && !!repo;

  const [filesOpen, setFilesOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");


  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [searchOn, setSearchOn] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [pendingCommit, setPendingCommit] = useState<EditorFile[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [listening, setListening] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

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
    if (config.cliMode && config.activeRepo && !tree) connectRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId, config.cliMode]);

  useEffect(() => {
    if (config.autoTerminal) setTerminalOpen(true);
  }, [config.autoTerminal]);

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
      setEditorFile({ path: file.path, content, language: detectLanguage(file.path) });
      setEditorOpen(true);
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  const readFileIntoInput = (f: globalThis.File) => {
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
      setAttachedFiles((prev) => [...prev, { path: f.name, content: reader.result as string }]);
    };
    reader.readAsText(f);
  };

  /* API */
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

  const callApi = useCallback(async (overrideAgent?: Agent | null) => {
    const store = useStore.getState();
    const active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }

    const chat = store.current();
    const lastUserMsg = chat?.messages.findLast?.((m) => m.role === "user");
    const messageAgentId = lastUserMsg?.agentId;
    const agent =
      overrideAgent !== undefined
        ? overrideAgent
        : messageAgentId
        ? AGENTS.find((a) => a.id === messageAgentId) ?? null
        : null;

    const apiMessages = (chat?.messages ?? []).map((m) => {
      if (m.images?.length) {
        const content: unknown[] = m.images.map((img) => ({ type: "image_url", image_url: { url: img } }));
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    const coderSystemPrompt = [
      config.systemPrompt,
      agent
        ? agent.systemPrompt
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.",
      config.rulesFile?.trim() ? `## Proje Kuralları (.rules)\n${config.rulesFile.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    store.pushMessage({ role: "assistant", content: "" });
    store.setStreaming(true);
    store.setFollowUpSuggestions([]);
    coderAbort = new AbortController();

    const thinkingMode = store.thinkingMode;
    let finalSystemPrompt = coderSystemPrompt;
    if (thinkingMode === "pro") {
      finalSystemPrompt +=
        "\n\n[Düşünme modu: PRO] Adım adım analiz et. Önce sorunu içselleştir, " +
        "olası yaklaşımları kıyasla, edge case'leri düşün, ardından gerekçeli çözümü ver. " +
        "Daha derin akıl yürütme yap, kısa kesme.";
    }

    const repo = store.repo;
    const activeGithub = store.activeGithub();
    const toolsEnabled = store.toolsEnabled && !!repo;

    try {
      const activeSkills = (store.config.skills ?? []).filter((s) => s.enabled);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: coderAbort.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey,
          provider: active.provider, systemPrompt: finalSystemPrompt,
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills.map((s) => ({
            title: s.title, content: s.content, tags: s.tags, source: s.source, fileName: s.fileName,
          })),
          tools: toolsEnabled,
          repoCtx: toolsEnabled && repo ? {
            owner: repo.owner,
            repo: repo.repo,
            branch: repo.branch,
            token: activeGithub?.token,
          } : undefined,
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
            const parsed = JSON.parse(data);
            /* tool event */
            if (parsed.tool_event) {
              const ev = parsed.tool_event;
              if (ev.phase === "start") {
                useStore.getState().appendToolCallToLast({
                  id: ev.id, name: ev.name, arguments: ev.arguments || "{}", status: "pending",
                });
              } else if (ev.phase === "end") {
                useStore.getState().updateToolCallOnLast(ev.id, {
                  result: ev.result, status: "done",
                });
              }
              continue;
            }
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; useStore.getState().updateLastContent(full); }
          } catch { /* parçalı satır */ }
        }
      }
      if (!full) useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");

      /* Skills kullanım sayacını artır (sadece başarılı yanıtta) */
      if (full && activeSkills.length > 0) {
        useStore.getState().incrementSkillUsage(activeSkills.map((s) => s.id));
      }

      /* AI'nın yazdığı dosyayı otomatik IDE'de aç + multi-commit bar */
      const autoFiles = extractAllFileFences(full);
      if (autoFiles.length > 0) {
        setEditorFile(autoFiles[0]);
        setEditorOpen(true);
      }
      setPendingCommit(autoFiles.length >= 2 ? autoFiles : null);

      /* token tahmini */
      const inputText = apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join("\n");
      const tokenIn = estimateTokens(inputText) + estimateTokens(coderSystemPrompt);
      const tokenOut = estimateTokens(full);
      useStore.getState().updateLastTokens(tokenIn, tokenOut);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        useStore.getState().updateLastContent(`**Hata:** ${(err as Error).message}\n\n_Anahtar/model doğru mu? Ayarlardan kontrol et._`);
      }
    } finally {
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      if (useStore.getState().config.soundEnabled) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch { /* yoksay */ }
      }
      fetchFollowUps();
    }
  }, [config.systemPrompt, fetchFollowUps]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0 && attachedFiles.length === 0) || streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    if (!store.currentId) store.newChat(incognito);
    setPendingCommit(null);

    /* slash command algıla */
    const detected = findAgentByCommand(text);
    const agent = detected ?? activeAgent;
    const userText = detected ? stripCommand(text) : text;

    let fullText = userText;
    if (attachedFiles.length > 0) {
      const ctx = attachedFiles
        .map((f) => `\`${f.path}\`:\n\`\`\`${getExt(f.path)}\n${f.content.slice(0, 12000)}\n\`\`\``)
        .join("\n\n");
      fullText = ctx + (userText ? "\n\n" + userText : "");
    }

    store.pushMessage({
      role: "user",
      content: fullText,
      images: pendingImages.length ? [...pendingImages] : undefined,
      agentId: agent?.id,
    });
    store.maybeSetTitle(userText || attachedFiles[0]?.path || agent?.label || "Kod analizi");
    setInput("");
    setPendingImages([]);
    setAttachedFiles([]);
    setActiveAgent(null);
    await callApi(agent);
  };

  const continueAnswer = async () => {
    if (streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    const chat = store.current();
    if (!chat || chat.messages.length === 0) return;
    store.pushMessage({ role: "user", content: "Kaldığın yerden tam olarak devam et. Tekrarlama, baştan başlama." });
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
  const attachedPaths = attachedFiles.map((f) => f.path);

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-bg"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); for (const f of Array.from(e.dataTransfer.files)) readFileIntoInput(f); }}
    >
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line/60 bg-surface/60 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          title="Yan panel (Ctrl+B)"
          className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors shrink-0"
        >
          <PanelLeft size={16} />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-brand/15 border border-brand/25 grid place-items-center">
            <Code2 size={13} className="text-brand" />
          </div>
          <span className="text-sm font-semibold text-ink">Craft<span className="brand-text">.Coder</span></span>
          {repo && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted/70 font-mono">
              {repo.owner}/{repo.repo}
              <span className="text-muted/40">:</span>
              <span className="text-cyan">{repo.branch}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0" />

        {/* Token + cost */}
        {current && (current.totalInTokens || current.totalOutTokens) ? (
          <UsageBadge chat={current} />
        ) : null}

        <div className="flex items-center gap-1 shrink-0">
          {config.models.length > 0 ? (
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-bgsoft" title="Model seç">
              <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
              <span className="truncate max-w-[140px] font-medium">
                {config.models.find((m) => m.id === config.activeModelId)?.label ||
                  config.models.find((m) => m.id === config.activeModelId)?.model || "Model seç"}
              </span>
            </button>
          ) : (
            <button onClick={() => setSettingsOpen(true)} className="text-xs px-2 py-1 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors">
              + Model
            </button>
          )}
          {incognito && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-purple/10 text-purple border border-purple/30">
              <VenetianMask size={9} /> Gizli
            </span>
          )}
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            title="Terminal"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${terminalOpen ? "text-green bg-green/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <Terminal size={14} />
          </button>
          <button
            onClick={() => setEditorOpen((v) => !v)}
            title="IDE'yi aç/kapat"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${editorOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <Code2 size={14} />
          </button>
          <button
            onClick={() => setGitPanelOpen((v) => !v)}
            title="Git işlemleri (dal, PR)"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${gitPanelOpen ? "text-purple-400 bg-purple-400/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <GitBranch size={14} />
          </button>
          <button
            onClick={() => useStore.getState().setSkillsOpen(true)}
            title="Skills — her sohbete eklenen bağlam"
            className="w-8 h-8 rounded-lg grid place-items-center transition-colors text-muted hover:text-amber-400 hover:bg-amber-400/10"
          >
            <Zap size={14} />
          </button>
          <ThinkingModeToggle />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Files panel (left) */}
        {filesOpen && (
          <div className="w-56 shrink-0 flex flex-col border-r border-line/60 bg-surface/40 overflow-hidden">
            <div className="px-3 py-2 border-b border-line/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50">
                {repo ? `${repo.owner}/${repo.repo}` : "Dosyalar"}
              </span>
              <div className="flex items-center gap-1">
                {repo && tree && (
                  <button
                    onClick={async () => {
                      setLoadingAll(true);
                      try {
                        const activeGithub = useStore.getState().activeGithub();
                        const allItems = [...Object.values(tree.dirs), ...tree.files].length > 0
                          ? await fetchAllFiles(repo.owner, repo.repo, repo.branch,
                              [...(useStore.getState().tree ? getTreeItems(useStore.getState().tree!) : [])],
                              activeGithub?.token)
                          : [];
                        if (allItems.length > 0) {
                          setAttachedFiles(allItems.map(f => ({ path: f.path, content: f.content })));
                          addToast(`${allItems.length} dosya yüklendi`, "success");
                        }
                      } catch { addToast("Yükleme başarısız", "error"); }
                      finally { setLoadingAll(false); }
                    }}
                    disabled={loadingAll}
                    title="Tüm dosyaları bağlama ekle (max 50)"
                    className="text-muted/40 hover:text-brand transition-colors disabled:opacity-30"
                  >
                    <ArrowDown size={10} className={loadingAll ? "animate-bounce" : ""} />
                  </button>
                )}
                {repo && (
                  <button onClick={connectRepo} disabled={connecting} title="Yenile" className="text-muted/40 hover:text-brand transition-colors">
                    <RefreshCw size={10} className={connecting ? "animate-spin" : ""} />
                  </button>
                )}
                <button onClick={() => setFilesOpen(false)} className="text-muted/40 hover:text-muted transition-colors">
                  <X size={11} />
                </button>
              </div>
            </div>

            {tree && (
              <div className="px-2 py-1.5 border-b border-line/40 shrink-0">
                <div className="relative">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Ara…"
                    className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {!tree ? (
                <div className="px-3 py-6 text-center">
                  <FolderGit2 size={22} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-[10px] text-muted/40 leading-relaxed mb-2">
                    {connecting ? "Yükleniyor…" : "GitHub deposu bağla"}
                  </p>
                  {!connecting && (
                    <button onClick={() => setSettingsOpen(true)} className="text-[10px] px-2 py-1 rounded-lg bg-brand/10 border border-brand/25 text-brand font-medium hover:bg-brand/20 transition-colors">
                      Ayarlar
                    </button>
                  )}
                  <div className="mt-4 pt-3 border-t border-line/30">
                    <button onClick={() => fileRef.current?.click()} className="text-[10px] text-muted/60 hover:text-ink transition-colors flex items-center gap-1 mx-auto">
                      <Paperclip size={10} /> Yerel dosya yükle
                    </button>
                  </div>
                </div>
              ) : repoSearch ? (
                <div className="py-1">
                  {filteredFiles.slice(0, 50).map((f) => {
                    const isAttached = attachedPaths.includes(f.path);
                    return (
                      <button
                        key={f.path}
                        onClick={() => attachRepoFile(f)}
                        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-left rounded transition-colors ${
                          isAttached ? "bg-brand/10 text-brand" : "text-muted/80 hover:text-ink hover:bg-bgsoft/50"
                        }`}
                      >
                        {fetchingFile === f.path ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" /> : <FileIcon name={f.name} size={10} />}
                        <span className="truncate flex-1">{f.path}</span>
                        {isAttached && <span className="text-[9px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <FileTreeNode node={tree} onSelect={attachRepoFile} attached={attachedPaths} />
              )}
            </div>

            <div className="px-2 py-2 border-t border-line/40 shrink-0">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-line/60 hover:border-brand/40 text-[11px] text-muted hover:text-ink transition-colors"
              >
                <Paperclip size={11} /> Dosya ekle
              </button>
            </div>
          </div>
        )}

        {/* Main: chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-16 select-none pointer-events-none">
                <div className="w-12 h-12 rounded-2xl brand-gradient grid place-items-center text-white text-xl mb-4 shadow-lg shadow-brand/20">
                  ◈
                </div>
                <h2 className="text-xl font-extrabold tracking-tight mb-1">Ne üzerinde çalışalım?</h2>
                <p className="text-sm text-muted/60 max-w-xs leading-relaxed">
                  Dosya ekle, kod yapıştır veya bir soru sor.<br />
                  <span className="text-muted/40 text-xs">/ ile agent seç · @ ile dosya mention</span>
                </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-5 py-6">
                {messages.map((m, i) => {
                  const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                  return (
                    <div key={i}>
                      <MessageBubble
                        index={i}
                        message={m}
                        showRegenerate={isLastAssistant && !streaming}
                        onRegenerate={regenerate}
                        onEdit={m.role === "user" ? editAndResend : undefined}
                      />
                      {isLastAssistant && !streaming && pendingCommit && pendingCommit.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl">
                          <MultiCommitBar
                            files={pendingCommit}
                            onClose={() => setPendingCommit(null)}
                            onOpenInEditor={(f) => { setEditorFile(f); setEditorOpen(true); }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {streaming && messages[messages.length - 1]?.content === "" && (
                  <div className="flex gap-3 py-4">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-brand/15 border border-brand/25 grid place-items-center">
                      <Code2 size={14} className="text-brand" />
                    </div>
                    <div className="flex items-center gap-1 pt-2">
                      <span className="typing-dot" />
                      <span className="typing-dot delay-1" />
                      <span className="typing-dot delay-2" />
                    </div>
                  </div>
                )}
                {!streaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content.length > 200 && (
                  <div className="flex justify-center mt-2 mb-3">
                    <button
                      onClick={continueAnswer}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-line bg-surface hover:border-brand/50 hover:text-ink transition-colors text-muted"
                      title="Cevap kısaldıysa kaldığı yerden devam ettir"
                    >
                      <ArrowDown size={11} /> Devam Et
                    </button>
                  </div>
                )}
                {!streaming && followUpSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 mb-4">
                    {followUpSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(s); setFollowUpSuggestions([]); }}
                        className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface hover:border-brand/50 transition-colors text-muted hover:text-ink"
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

          {/* Terminal */}
          {terminalOpen && (
            <RealTerminal onClose={() => setTerminalOpen(false)} />
          )}

          {/* Composer */}
          <div className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2 pb-4">
            <div className="max-w-3xl mx-auto px-5 relative">

              {/* Slash menu */}
              {slashOpen && (
                <SlashMenu
                  query={slashQuery}
                  onSelect={(a) => {
                    setActiveAgent(a);
                    setInput("");
                    setSlashOpen(false);
                    taRef.current?.focus();
                  }}
                  onClose={() => setSlashOpen(false)}
                />
              )}

              {/* Mention menu */}
              {mentionOpen && attachedFiles.length > 0 && (
                <MentionMenu
                  query={mentionQuery}
                  items={attachedFiles.map((f) => ({ path: f.path }))}
                  onSelect={(item) => {
                    const ta = taRef.current;
                    if (!ta) return;
                    const pos = ta.selectionStart;
                    const before = input.slice(0, pos);
                    const after = input.slice(pos);
                    const atIdx = before.lastIndexOf("@");
                    if (atIdx === -1) return;
                    const newText = before.slice(0, atIdx) + `@${item.path} ` + after;
                    setInput(newText);
                    setMentionOpen(false);
                    setTimeout(() => {
                      ta.focus();
                      const newPos = atIdx + item.path.length + 2;
                      ta.setSelectionRange(newPos, newPos);
                    }, 0);
                  }}
                  onClose={() => setMentionOpen(false)}
                />
              )}

              {/* Active agent badge */}
              {activeAgent && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs">
                    <span>{activeAgent.icon}</span>
                    <code className="font-mono font-bold">{activeAgent.command}</code>
                    <span className="text-brand/70">{activeAgent.label}</span>
                    <button
                      onClick={() => setActiveAgent(null)}
                      className="hover:text-red transition-colors ml-1"
                      title="Agent'ı kaldır"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* Attached files */}
              {attachedFiles.length > 0 && (
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  {attachedFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-brand/10 border border-brand/25 text-brand">
                      <FileIcon name={f.path.split("/").pop() ?? ""} size={11} />
                      <span className="max-w-[180px] truncate font-mono">{f.path.split("/").pop()}</span>
                      <button onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.path !== f.path))} className="text-brand/60 hover:text-red transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingImages.length > 0 && (
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group/img">
                      <img src={img} alt="" className="w-16 h-16 object-cover rounded-xl border border-line shadow-sm" />
                      <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red text-white grid place-items-center text-xs opacity-0 group-hover/img:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              )}

              <input ref={fileRef} type="file" multiple accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php" className="hidden"
                onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) readFileIntoInput(f); e.target.value = ""; }} />
              <input ref={imgRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />

              {/* Textarea — geniş, butonsuz */}
              <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-4 py-2.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_rgba(124,92,255,0.08)] transition-all">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    const pos = e.target.selectionStart;
                    const before = v.slice(0, pos);
                    const slashMatch = before.match(/(^|\n)(\/\w*)$/);
                    if (slashMatch) { setSlashQuery(slashMatch[2]); setSlashOpen(true); }
                    else setSlashOpen(false);
                    const mentionMatch = before.match(/(^|\s)@(\S*)$/);
                    if (mentionMatch && attachedFiles.length > 0) {
                      setMentionQuery(mentionMatch[2]); setMentionOpen(true);
                    } else setMentionOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (slashOpen || mentionOpen) return;
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  placeholder={
                    activeAgent
                      ? activeAgent.placeholder
                      : attachedFiles.length > 0
                      ? `${attachedFiles.length} dosya eklendi — sor veya / yaz…`
                      : "Mesajınızı yazın…"
                  }
                  className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed max-h-[240px] py-1 placeholder:text-muted/45"
                />

                {streaming ? (
                  <button onClick={stop} className="shrink-0 w-9 h-9 rounded-xl bg-red hover:bg-red/80 text-white grid place-items-center transition-colors" title="Durdur">
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                    className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowUp size={17} />
                  </button>
                )}
              </div>

              {/* Alt araç çubuğu */}
              <div className="flex items-center justify-between mt-2 px-0.5">
                <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
                  <ComposerButton onClick={() => setFilesOpen((v) => !v)} active={filesOpen} title="Depo dosyaları">
                    <FolderOpen size={13} />
                    <span>Dosyalar</span>
                  </ComposerButton>
                  <ComposerButton onClick={() => fileRef.current?.click()} title="Dosya ekle">
                    <Paperclip size={13} />
                    <span>Ekle</span>
                  </ComposerButton>
                  <ComposerButton onClick={() => imgRef.current?.click()} title="Görsel ekle">
                    <ImageIcon size={13} />
                  </ComposerButton>
                  <ComposerButton onClick={() => setSearchOn(!searchOn)} active={searchOn} title="Web arama">
                    <Globe size={13} />
                    <span>Web</span>
                  </ComposerButton>
                  <ComposerButton
                    onClick={() => {
                      const msgs = useStore.getState().current()?.messages ?? [];
                      for (let i = msgs.length - 1; i >= 0; i--) {
                        const m = /```(html|svg|mermaid)\n([\s\S]*?)\n```/.exec(msgs[i].content);
                        if (m) {
                          useStore.getState().setArtifact({
                            type: m[1] as "html" | "svg" | "mermaid",
                            content: m[2],
                            title: `${m[1].toUpperCase()} Önizleme`,
                          });
                          return;
                        }
                      }
                      addToast("Önizlenecek HTML, SVG veya Mermaid kodu bulunamadı", "info");
                    }}
                    active={!!artifact}
                    title="Canvas önizleme"
                  >
                    <Palette size={13} />
                    <span>Canvas</span>
                  </ComposerButton>
                  <ComposerButton onClick={() => useStore.getState().setPromptLibraryOpen(true)} title="Şablonlar">
                    <BookOpen size={13} />
                    <span>Şablonlar</span>
                  </ComposerButton>
                  <ComposerButton onClick={() => useStore.getState().setSnippetsOpen(true)} title="Snippet kütüphanesi">
                    <BookmarkPlus size={13} />
                    <span>Snippets</span>
                  </ComposerButton>
                  <ComposerButton
                    onClick={() => { setSlashQuery("/"); setSlashOpen((o) => !o); }}
                    active={!!activeAgent || slashOpen}
                    title="Subagent seç ( / )"
                  >
                    <Sparkles size={13} />
                    <span>{activeAgent ? activeAgent.command : "Agent"}</span>
                  </ComposerButton>
                  <ComposerButton
                    onClick={() => {
                      const store = useStore.getState();
                      if (!store.repo) {
                        addToast("Tool-use için önce bir GitHub deposu bağla", "error");
                        return;
                      }
                      store.setToolsEnabled(!store.toolsEnabled);
                    }}
                    active={toolsEnabled}
                    title={toolsEnabled ? "Tool-use açık" : "Tool-use kapalı"}
                  >
                    <Wrench size={13} />
                    <span>Tools</span>
                  </ComposerButton>

                  {typeof window !== "undefined" && "webkitSpeechRecognition" in window && (
                    <button
                      onClick={() => {
                        const SR = (window as typeof window & { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
                        const recognition = new SR();
                        recognition.lang = "tr-TR";
                        recognition.continuous = false;
                        recognition.interimResults = false;
                        recognition.onresult = (e: SpeechRecognitionEvent) => {
                          setInput((prev) => prev + (prev ? " " : "") + e.results[0][0].transcript);
                          setListening(false);
                        };
                        recognition.onerror = () => setListening(false);
                        recognition.onend = () => setListening(false);
                        setListening(true);
                        recognition.start();
                      }}
                      title="Sesle yaz"
                      className={`flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors ${
                        listening ? "text-red-400 bg-red-400/10 animate-pulse" : "text-muted hover:text-ink hover:bg-bgsoft"
                      }`}
                    >
                      <Mic size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted/50 shrink-0">
                  {searchOn && <span className="text-brand font-medium">Web</span>}
                  {toolsEnabled && <span className="text-green/80 font-medium">Tools</span>}
                  {activeAgent && <span className="text-brand font-medium">{activeAgent.command}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {editorOpen && (
          editorFile ? (
            <div className="w-[520px] shrink-0 flex flex-col min-h-0 overflow-hidden">
              <EditorPanel
                file={editorFile}
                onClose={() => setEditorOpen(false)}
                onAskAI={(text, context) => {
                  useStore.getState().setPendingInput(context);
                }}
              />
            </div>
          ) : (
            <div className="w-[520px] shrink-0 flex flex-col min-h-0 overflow-hidden border-l border-line/60 bg-[#0e0e13]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-line/60 bg-surface shrink-0">
                <span className="text-xs font-mono text-muted/50">IDE</span>
                <button onClick={() => setEditorOpen(false)} className="text-muted hover:text-ink p-1 rounded transition-colors">
                  <X size={13} />
                </button>
              </div>
              <div className="flex-1 grid place-items-center">
                <div className="text-center px-8">
                  <Code2 size={36} className="mx-auto mb-3 text-muted/20" />
                  <p className="text-sm text-muted/50">AI bir dosya yazınca burada açılır</p>
                  <p className="text-xs mt-1.5 text-muted/30">veya sol panelden bir dosya seçin</p>
                </div>
              </div>
            </div>
          )
        )}
        {artifact && <ArtifactPanel />}
        {gitPanelOpen && (
          <GitPanel onClose={() => setGitPanelOpen(false)} />
        )}
      </div>
    </div>
  );
}

function getTreeItems(node: import("@/lib/types").TreeNode): { path: string; type: string }[] {
  const items: { path: string; type: string }[] = [];
  for (const f of node.files) items.push({ path: f.path, type: "blob" });
  for (const child of Object.values(node.dirs)) items.push(...getTreeItems(child));
  return items;
}

/* ── Token + cost rozeti ── */
function UsageBadge({ chat }: { chat: { totalInTokens?: number; totalOutTokens?: number } }) {
  const config = useStore((s) => s.config);
  const tokenIn = chat.totalInTokens ?? 0;
  const tokenOut = chat.totalOutTokens ?? 0;
  const total = tokenIn + tokenOut;
  const activeModel = config.models.find((m) => m.id === config.activeModelId);
  const cost = activeModel ? calculateCost(activeModel.model, tokenIn, tokenOut) : null;
  const hasPrice = activeModel ? getModelPrice(activeModel.model) !== null : false;

  return (
    <div
      className="hidden md:flex items-center gap-1.5 text-[10px] text-muted/70 font-mono px-2 py-1 rounded-lg border border-line/40 mr-1"
      title={`Girdi: ${tokenIn.toLocaleString()} · Çıktı: ${tokenOut.toLocaleString()} token`}
    >
      <span>{total.toLocaleString()} tok</span>
      {cost !== null && hasPrice && (
        <>
          <span className="text-muted/40">·</span>
          <span className="text-brand/80">{formatCost(cost)}</span>
        </>
      )}
    </div>
  );
}

/* Parses the first code-fence with an embedded file path from AI output.
   Supports: ```lang:path  |  ```lang file=path  |  ```lang title="path" */
function extractFirstFileFence(md: string): EditorFile | null {
  return extractAllFileFences(md)[0] ?? null;
}

/* Same parser but returns every match, dedup'd by path (last wins). */
function extractAllFileFences(md: string): EditorFile[] {
  const re = /```(\w+)(?::([^\s\n`]+)|[ \t]+(?:file|title)=["']?([^\s"'\n`]+)["']?)/g;
  const map = new Map<string, EditorFile>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const path = (m[2] ?? m[3] ?? "").trim();
    if (!path || (!path.includes("/") && !path.includes("."))) continue;
    const fenceEnd = m.index + m[0].length;
    const nlIdx = md.indexOf("\n", fenceEnd);
    if (nlIdx === -1) continue;
    const closeIdx = md.indexOf("\n```", nlIdx);
    const content = closeIdx === -1 ? md.slice(nlIdx + 1) : md.slice(nlIdx + 1, closeIdx);
    map.set(path, { path, content, language: detectLanguage(path) });
  }
  return Array.from(map.values());
}
