"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  GitPullRequest,
  Globe,
  Image as ImageIcon,
  Loader2 as Loader2Icon,
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
import { extractAllFileFences } from "@/lib/parsers";

import { RightPanel } from "./RightPanel";

import { MultiCommitBar } from "./MultiCommitBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { EmptyChat } from "./EmptyChat";
import { ExportMenu } from "./ExportMenu";
import { VoiceButton } from "./VoiceButton";

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
import {
  buildGitLabTree,
  fetchAllGitLabFiles,
  fetchGitLabFileContent,
  fetchGitLabRepoTree,
  isGitLabRepo,
  parseGitLabRepo,
} from "@/lib/gitlab";
import type { TreeFile, TreeNode } from "@/lib/types";
import { AGENTS, findAgentByCommand, stripCommand, type Agent } from "@/lib/agents";
import { calculateCost, estimateTokens, formatCost, getModelPrice } from "@/lib/pricing";
import { STYLE_LABELS } from "@/lib/constants";

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
      className={`flex items-center gap-1.5 text-[12px] px-2 py-2 sm:py-1.5 rounded-lg transition-colors active:scale-95 ${
        active
          ? "text-brand bg-brand/10"
          : "text-muted hover:text-ink hover:bg-bgsoft active:bg-bgsoft"
      }`}
    >
      {children}
    </button>
  );
}

const THINKING_LEVELS = [
  { key: "low",    label: "Düşük", short: "D" },
  { key: "medium", label: "Orta",  short: "O" },
  { key: "high",   label: "Yüksek", short: "Y" },
  { key: "max",    label: "Max",   short: "M" },
] as const;

function ThinkingModeToggle() {
  const thinkingMode = useStore((s) => s.thinkingMode);
  const setThinkingMode = useStore((s) => s.setThinkingMode);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = THINKING_LEVELS.find((l) => l.key === thinkingMode) ?? THINKING_LEVELS[1];

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dropdown = open ? (
    <div
      style={{ top: pos.top, right: pos.right, position: "fixed", zIndex: 9999 }}
      className="bg-surface border border-line rounded-xl shadow-2xl shadow-black/50 p-1 min-w-[140px] animate-fade-in"
    >
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted/50 px-2 pt-1 pb-1.5">Düşünce Derinliği</div>
      {THINKING_LEVELS.map((l) => (
        <button
          key={l.key}
          onClick={() => { setThinkingMode(l.key); setOpen(false); }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
            thinkingMode === l.key
              ? "bg-brand/15 text-brand font-semibold"
              : "text-muted hover:text-ink hover:bg-bgsoft"
          }`}
        >
          <span>{l.label}</span>
          {thinkingMode === l.key && <span className="text-[9px] text-brand/60">●</span>}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Düşünce derinliği"
        className="flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors font-semibold text-brand bg-brand/10 hover:bg-brand/15"
      >
        <Brain size={13} />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.short}</span>
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
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
  const [terminalSupported, setTerminalSupported] = useState(true);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");


  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
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
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prNumber, setPrNumber] = useState("");
  const [prLoading, setPrLoading] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];
  const activeRepoStr = config.activeRepo || "";
  const repoIsGitLab = isGitLabRepo(activeRepoStr);

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  useEffect(() => {
    /* silently restore last mounted folder if browser still grants permission */
    import("@/lib/localfs").then(({ restoreMounted }) => restoreMounted().catch(() => { /* ignore */ }));
    import("@/lib/webcontainer").then(({ isSupported }) => setTerminalSupported(isSupported()));
  }, []);

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
    const activeRepo = store.config.activeRepo || "";
    setConnecting(true);
    try {
      if (isGitLabRepo(activeRepo)) {
        const parsed = parseGitLabRepo(activeRepo);
        if (!parsed) { addToast("Geçersiz GitLab deposu. Örnek: gitlab.com/namespace/repo", "error"); return; }
        const token = store.activeGitlab()?.token;
        const { branch, items } = await fetchGitLabRepoTree(parsed.namespace, parsed.repo, token);
        setRepo({ owner: parsed.namespace, repo: parsed.repo, branch });
        setTree(buildGitLabTree(items));
      } else {
        const parsed = parseRepo(activeRepo);
        if (!parsed) { addToast("Ayarlar'dan bir GitHub veya GitLab deposu ekle.", "error"); return; }
        const token = store.activeGithub()?.token;
        const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token);
        setRepo({ ...parsed, branch });
        setTree(buildTree(items));
      }
    } catch (e) {
      addToast(`Depo bağlantısı başarısız: ${(e as Error).message}`, "error");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (config.cliMode && config.activeRepo && !tree) connectRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId, config.activeGitlabId, config.cliMode]);

  /* CodeBlock emits this when the user types a path into its "Diff" prompt.
     We look it up in the currently attached files and seed the modal's
     "original" side. Without this listener the diff against an existing
     file always rendered as if the file were empty. */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string; newCode: string; language: string }>).detail;
      if (!detail?.path) return;
      const match = attachedFiles.find((f) => f.path === detail.path);
      if (!match) return;
      useStore.getState().setDiffModal({
        original: match.content,
        newCode: detail.newCode,
        language: detail.language,
        path: detail.path,
      });
    };
    window.addEventListener("craftai:diff-request", handler);
    return () => window.removeEventListener("craftai:diff-request", handler);
  }, [attachedFiles]);

  useEffect(() => {
    if (!config.autoTerminal) return;
    import("@/lib/webcontainer").then(({ isSupported }) => {
      if (isSupported()) setTerminalOpen(true);
    });
  }, [config.autoTerminal]);

  const attachRepoFile = async (file: TreeFile) => {
    if (attachedFiles.find((f) => f.path === file.path)) {
      setAttachedFiles((prev) => prev.filter((f) => f.path !== file.path));
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const store = useStore.getState();
      const activeRepo = store.config.activeRepo || "";
      let content: string;
      if (isGitLabRepo(activeRepo)) {
        const token = store.activeGitlab()?.token;
        content = await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      } else {
        const token = store.activeGithub()?.token;
        content = await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, token);
      }
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

    const activeProject = config.projects.find((p) => p.id === config.activeProjectId);
    const coderSystemPrompt = [
      config.systemPrompt,
      agent
        ? agent.systemPrompt
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.",
      activeProject?.systemPrompt?.trim() ? `## Proje: ${activeProject.name}\n${activeProject.systemPrompt.trim()}` : "",
      config.rulesFile?.trim() ? `## Proje Kuralları (.rules)\n${config.rulesFile.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    store.pushMessage({ role: "assistant", content: "" });
    store.setStreaming(true);
    store.setFollowUpSuggestions([]);
    coderAbort = new AbortController();

    const thinkingMode = store.thinkingMode;
    let finalSystemPrompt = coderSystemPrompt;
    if (thinkingMode === "medium") {
      finalSystemPrompt += "\n\n[Düşünme: ORTA] Kısa bir iç değerlendirme yap, ardından net yanıt ver.";
    } else if (thinkingMode === "high") {
      finalSystemPrompt +=
        "\n\n[Düşünme: YÜKSEK] Adım adım analiz et. Sorunu içselleştir, " +
        "olası yaklaşımları kıyasla, edge case'leri düşün, ardından gerekçeli çözümü ver.";
    } else if (thinkingMode === "max") {
      finalSystemPrompt +=
        "\n\n[Düşünme: MAX] En derin analizi yap. Problemi birden fazla açıdan incele, " +
        "tüm alternatif yaklaşımları değerlendir, olası hataları ve edge case'leri listele, " +
        "güvenlik ve performans etkilerini değerlendir, ardından en sağlam çözümü tam gerekçesiyle sun. Kısa kesme.";
    }

    const repo = store.repo;
    const activeGithub = store.activeGithub();
    const activeGitlab = store.activeGitlab();
    const toolsEnabled = store.toolsEnabled && !!repo;
    const activeRepo = store.config.activeRepo || "";
    const repoIsGitLab = isGitLabRepo(activeRepo);

    try {
      const allEnabledSkills = (store.config.skills ?? []).filter((s) => s.enabled);
      /* Relevance scoring: compare skill text against the last user message.
         If ≤5 skills, include all; otherwise pick top-5 by keyword overlap. */
      const activeSkills = (() => {
        if (allEnabledSkills.length <= 5) return allEnabledSkills;
        const lastUserText = (chat?.messages.findLast?.((m) => m.role === "user")?.content ?? "").toLowerCase();
        const queryWords = new Set(lastUserText.split(/\W+/).filter((w) => w.length > 3));
        if (queryWords.size === 0) return allEnabledSkills.slice(0, 5);
        const scored = allEnabledSkills.map((s) => {
          const haystack = (s.title + " " + s.content + " " + (s.tags ?? []).join(" ")).toLowerCase().split(/\W+/);
          const hits = haystack.filter((w) => queryWords.has(w)).length;
          return { skill: s, hits };
        });
        return scored.sort((a, b) => b.hits - a.hits).slice(0, 5).map((x) => x.skill);
      })();
      /* Pollinations: tarayıcıdan doğrudan çağrı yapılır (her kullanıcı kendi IP'sini kullanır,
         sunucu IP'si paylaşıldığında oluşan rate-limit sorunu önlenir). CORS açık. */
      let res: Response;
      if (active.provider === "pollinations") {
        let sysContent = finalSystemPrompt;
        const styleP = STYLE_LABELS[store.config.style]?.prompt;
        if (styleP) sysContent += `\n\n[Stil]: ${styleP}`;
        if (store.config.memories?.length) {
          sysContent += `\n\n[Kullanıcı hakkında bildiklerin]:\n${store.config.memories.map((m) => `- ${m.content}`).join("\n")}`;
        }
        if (activeSkills.length) {
          const fileSkills = activeSkills.filter((s) => s.source === "file");
          const manualSkills = activeSkills.filter((s) => s.source !== "file");
          if (manualSkills.length) sysContent += `\n\n[Eğitim seti]:\n${manualSkills.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`;
          if (fileSkills.length) sysContent += `\n\n[Referans dosyalar]:\n${fileSkills.map((s) => `--- ${s.fileName || s.title} ---\n${s.content}`).join("\n\n")}`;
        }
        const polBody = JSON.stringify({
          model: active.model,
          messages: [{ role: "system", content: sysContent }, ...apiMessages],
          stream: true,
        });
        const RETRY_DELAYS = [5000, 10000, 20000];
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          res = await fetch(`${active.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: coderAbort.signal,
            body: polBody,
          });
          if (res.status !== 429 || attempt >= RETRY_DELAYS.length) break;
          const wait = RETRY_DELAYS[attempt++];
          addToast(`Pollinations yoğun, ${wait / 1000}s sonra yeniden deneniyor... (${attempt}/${RETRY_DELAYS.length})`, "info");
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, wait);
            coderAbort.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
          });
          if (coderAbort.signal.aborted) throw new DOMException("Aborted", "AbortError");
        }
      } else {
        res = await fetch("/api/chat", {
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
              token: repoIsGitLab ? activeGitlab?.token : activeGithub?.token,
              provider: repoIsGitLab ? "gitlab" : "github",
            } : undefined,
            mcpServers: (store.config.mcpServers ?? []).filter((s) => s.enabled).map((s) => ({
              url: s.url,
              headers: s.headers,
              enabled: s.enabled,
            })),
          }),
        });
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429) throw new Error(`⏱️ İstek limiti aşıldı [${active.provider} / ${active.model}]: 30-60 saniye bekle ve tekrar dene.`);
        throw new Error(detail || `Hata ${res.status}`);
      }

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
            const reasoning = (parsed.choices?.[0]?.delta as Record<string, unknown>)?.reasoning as string | undefined;
            if (reasoning) useStore.getState().updateLastThinking(reasoning);
            if (delta) { full += delta; useStore.getState().updateLastContent(full); }
          } catch { /* parçalı satır */ }
        }
      }
      if (!full) useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");

      /* Extended thinking: <think>...</think> bloklarını ayır */
      {
        const thinkMatch = full.match(/^<think>([\s\S]*?)<\/think>\s*/);
        if (thinkMatch) {
          const thinking = thinkMatch[1].trim();
          const cleanContent = full.slice(thinkMatch[0].length).trim();
          if (cleanContent) useStore.getState().updateLastContent(cleanContent);
          if (thinking) useStore.getState().updateLastThinking(thinking);
        }
      }

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
        const { playReady, notifyReady } = await import("@/lib/sounds");
        playReady();
        notifyReady("craft.ai", "Yanıt hazır.");
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
    if (store.config.soundEnabled) import("@/lib/sounds").then((m) => m.playSend());

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

  /* Keep the previous answer; ask the model to pick up where it left off.
     Useful when the stream was stopped, hit a token cap, or got truncated. */
  const continueLast = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    if (!chat || chat.messages.length === 0) return;
    if (chat.messages[chat.messages.length - 1].role !== "assistant") return;
    store.pushMessage({ role: "user", content: "Lütfen tam olarak kaldığın yerden devam et. Önceki cevabını tekrar etme." });
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
      className="relative flex flex-col h-full min-h-0 bg-bg"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        /* only fire when the cursor actually leaves the outer container */
        if (e.target === e.currentTarget) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        for (const f of Array.from(e.dataTransfer.files)) readFileIntoInput(f);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5 grid place-items-center backdrop-blur-sm animate-in fade-in duration-150">
          <div className="text-center px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand/15 grid place-items-center text-brand text-2xl shadow-lg shadow-brand/10">
              ↓
            </div>
            <p className="text-sm font-extrabold text-ink">Dosyaları buraya bırak</p>
            <p className="text-xs text-muted/60 mt-1">Birden çok dosya destekli · görseller de olur</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div
        className="h-12 shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 border-b border-line/60 bg-surface/60 backdrop-blur-sm overflow-x-auto scrollbar-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
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
          <span className="text-sm font-semibold text-ink">craft<span className="brand-text">.coder</span></span>
          {repo && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted/70 font-mono">
              {repo.owner}/{repo.repo}
              <span className="text-muted/40">:</span>
              <span className="text-brand/80">{repo.branch}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0" />

        {/* Token + cost */}
        {current && (current.totalInTokens || current.totalOutTokens) ? (
          <UsageBadge chat={current} />
        ) : null}

        {/* Export menu */}
        {current && messages.length > 0 && (
          <ExportMenu chatId={current.id} />
        )}

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
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30">
              <VenetianMask size={9} /> Gizli
            </span>
          )}
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            title={terminalSupported ? "Terminal" : "Terminal (masaüstü Chrome/Edge gerekli)"}
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${
              terminalOpen ? "text-green bg-green/10" :
              terminalSupported ? "text-muted hover:text-ink hover:bg-bgsoft" :
              "text-muted/40 hover:text-muted/60 hover:bg-bgsoft"
            }`}
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
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${gitPanelOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <GitBranch size={14} />
          </button>
          {repo && (
            <button
              onClick={() => setPrModalOpen(true)}
              title="PR / MR inceleme"
              className="w-8 h-8 rounded-lg grid place-items-center transition-colors text-muted hover:text-brand hover:bg-brand/10"
            >
              <GitPullRequest size={14} />
            </button>
          )}
          <button
            onClick={() => useStore.getState().setSkillsOpen(true)}
            title="Skills — her sohbete eklenen bağlam"
            className="w-8 h-8 rounded-lg grid place-items-center transition-colors text-muted hover:text-brand hover:bg-brand/10"
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
                        const store = useStore.getState();
                        const activeRepo = store.config.activeRepo || "";
                        const treeItems = store.tree ? getTreeItems(store.tree) : [];
                        let allItems: { path: string; content: string }[] = [];
                        if (isGitLabRepo(activeRepo)) {
                          const token = store.activeGitlab()?.token;
                          allItems = await fetchAllGitLabFiles(repo.owner, repo.repo, repo.branch, treeItems, token);
                        } else {
                          const token = store.activeGithub()?.token;
                          allItems = await fetchAllFiles(repo.owner, repo.repo, repo.branch, treeItems, token);
                        }
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

          {/* Token budget warning banner */}
          {current && config.maxContext > 0 && (() => {
            const tokenIn = current.totalInTokens ?? 0;
            const pct = Math.min(100, (tokenIn / config.maxContext) * 100);
            if (pct < 80) return null;
            const isDanger = pct >= 95;
            return (
              <div className={`shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b ${
                isDanger
                  ? "bg-red/5 border-red/20 text-red"
                  : "bg-amber-400/5 border-amber-400/20 text-amber-400"
              }`}>
                <span>{isDanger ? "⛔" : "⚠️"}</span>
                <span>
                  Bağlam dolumu {pct.toFixed(0)}% — {isDanger
                    ? "Limit aşılmak üzere, yeni sohbet başlatmanı öneririm."
                    : "Sohbet uzuyor, yakında limit dolabilir."}
                </span>
              </div>
            );
          })()}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyChat
                hasModel={config.models.length > 0}
                hasRepo={!!repo}
                onAddModel={() => setSettingsOpen(true)}
                onPrompt={(text) => setInput(text)}
              />
            ) : (
              <div className="max-w-3xl mx-auto px-5 py-6">
                {messages.map((m, i) => {
                  const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                  return (
                    <div key={i}>
                      <MessageBubble
                        index={i}
                        message={m}
                        chatId={current?.id}
                        showRegenerate={isLastAssistant && !streaming}
                        onRegenerate={regenerate}
                        onContinue={isLastAssistant && m.content ? continueLast : undefined}
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
            <ErrorBoundary variant="inline" label="Terminal çöktü">
              <RealTerminal onClose={() => setTerminalOpen(false)} />
            </ErrorBoundary>
          )}

          {/* Composer */}
          <div
            className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
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
              <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-4 py-3 sm:py-2.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_rgba(200,168,126,0.12)] transition-all">
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
                  className="flex-1 bg-transparent resize-none outline-none text-[15px] sm:text-[15px] leading-relaxed max-h-[240px] py-1 placeholder:text-muted/45"
                />

                {!streaming && (
                  <VoiceButton
                    onTranscript={(text, isFinal) => {
                      /* interim: replace tail; final: append + space */
                      setInput((cur) => {
                        if (isFinal) return (cur + (cur && !cur.endsWith(" ") ? " " : "") + text).trimStart();
                        return cur;
                      });
                    }}
                  />
                )}
                {streaming ? (
                  <button onClick={stop} className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-red hover:bg-red/80 active:bg-red/70 text-white grid place-items-center transition-colors" title="Durdur">
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                    className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-brand hover:bg-branddim active:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

        <RightPanel
          editorFile={editorFile}
          editorOpen={editorOpen}
          onCloseEditor={() => setEditorOpen(false)}
          onAskAI={(_text, context) => {
            useStore.getState().setPendingInput(context);
          }}
          gitOpen={gitPanelOpen}
          onCloseGit={() => setGitPanelOpen(false)}
          artifact={artifact}
        />
      </div>

      {/* PR / MR Review Modal */}
      {prModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPrModalOpen(false)}>
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitPullRequest size={16} className="text-brand" />
                <h3 className="font-bold text-sm">PR / MR İnceleme</h3>
              </div>
              <button onClick={() => setPrModalOpen(false)} className="text-muted hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted mb-3">
              {repoIsGitLab ? "GitLab MR" : "GitHub PR"} numarasını gir. AI diff&apos;i okuyup kod incelemesi yapacak.
            </p>
            <input
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="#123"
              className="input-mono w-full mb-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handlePrReview(); }}
            />
            <button
              onClick={() => void handlePrReview()}
              disabled={!prNumber || prLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-branddim disabled:opacity-50 transition-colors"
            >
              {prLoading ? <Loader2Icon size={14} className="animate-spin" /> : <><GitPullRequest size={14} /> İncele</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  async function handlePrReview() {
    if (!prNumber || !repo) return;
    setPrLoading(true);
    try {
      const token = repoIsGitLab ? store.activeGitlab()?.token : store.activeGithub()?.token;
      const res = await fetch("/api/pr-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: repoIsGitLab ? "gitlab" : "github",
          owner: repo.owner,
          repo: repo.repo,
          prNumber: parseInt(prNumber, 10),
          token,
        }),
      });
      const data = await res.json() as { diff?: string; error?: string };
      if (!res.ok || !data.diff) {
        useStore.getState().addToast(data.error ?? "PR bulunamadı", "error");
        return;
      }
      const reviewPrompt = `Aşağıdaki ${repoIsGitLab ? "GitLab MR" : "GitHub PR"} #${prNumber} diff'ini detaylı olarak incele:\n\n\`\`\`diff\n${data.diff}\n\`\`\`\n\nŞu başlıklar altında incele: 🐛 Hatalar, 🔒 Güvenlik, ⚡ Performans, ✅ En İyi Pratikler. Her bulgu için ciddiyet (düşük/orta/yüksek) belirt.`;
      useStore.getState().setPendingInput(reviewPrompt);
      setPrModalOpen(false);
      setPrNumber("");
    } catch (e) {
      useStore.getState().addToast((e as Error).message, "error");
    } finally {
      setPrLoading(false);
    }
  }
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
  /* % of context window used by the *input* (chat history) */
  const pct = config.maxContext > 0 ? Math.min(100, (tokenIn / config.maxContext) * 100) : 0;
  const warn = pct >= 80;
  const danger = pct >= 95;

  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg border mr-1 transition-colors ${
        danger ? "border-red/40 bg-red/5 text-red"
        : warn ? "border-amber-400/40 bg-amber-400/5 text-amber-400"
        : "border-line/40 text-muted/70"
      }`}
      title={
        `Girdi: ${tokenIn.toLocaleString()} · Çıktı: ${tokenOut.toLocaleString()} token` +
        `\nBağlam penceresi: ${pct.toFixed(0)}% (${tokenIn.toLocaleString()}/${config.maxContext.toLocaleString()})` +
        (cost ? `\nTahmini maliyet: ~$${cost.toFixed(4)}` : "")
      }
    >
      {/* mini progress dot */}
      <span className="relative w-3 h-3" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-current opacity-15" />
        <span
          className="absolute inset-0 rounded-full bg-current"
          style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
        />
      </span>
      <span>{total.toLocaleString()} tok</span>
      {cost !== null && hasPrice && (
        <>
          <span className="opacity-40">·</span>
          <span className={danger || warn ? "" : "text-brand/80"}>{formatCost(cost)}</span>
        </>
      )}
    </div>
  );
}

