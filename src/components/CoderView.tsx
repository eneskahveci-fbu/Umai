"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  ChevronDown,
  GitBranch,
  ChevronRight,
  Code2,
  Copy,
  Download,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  GitPullRequest,
  Globe,
  MoreHorizontal,
  Image as ImageIcon,
  Loader2 as Loader2Icon,
  Palette,
  PanelLeft,
  Paperclip,
  Check,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
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
import { buildContextSections } from "@/lib/prompt";
import { PLATFORM_KNOWLEDGE } from "@/lib/platform-knowledge";
import { addPendingAction, removePendingAction, isCommandAllowed, DEFAULT_COMMAND_ALLOWLIST, type PendingAction } from "@/lib/agentActions";

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

/* "⋯ Daha fazla" — az kullanılan eylemleri tek menüde toplar.
   Açılır menü createPortal ile body'e render edilir (overflow kabı kırpmasın).
   placement: "top" (composer, yukarı açılır) | "bottom" (header, aşağı açılır). */
function MoreMenu({ active, children, placement = "top", icon }: { active?: boolean; children: React.ReactNode; placement?: "top" | "bottom"; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos(placement === "bottom"
        ? { left: r.right, top: r.bottom + 8 }
        : { left: r.right, bottom: window.innerHeight - r.top + 8 });
    };
    update();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, placement]);
  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Daha fazla"
        className={`flex items-center gap-1.5 text-[12px] px-2 py-2 sm:py-1.5 rounded-lg transition-colors active:scale-95 ${
          open || active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft active:bg-bgsoft"
        }`}
      >
        {icon ?? <MoreHorizontal size={13} />}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, transform: "translateX(-100%)" }}
          className="min-w-[190px] bg-surface border border-line rounded-xl shadow-2xl shadow-black/40 p-1 z-[80] flex flex-col gap-0.5 animate-modal-bg"
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MoreItem({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 text-[12px] px-2.5 py-2 rounded-lg text-left transition-colors ${
        active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      {icon}
      <span>{label}</span>
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
  const dropdownRef = useRef<HTMLDivElement>(null);
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
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setOpen(false);
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
      ref={dropdownRef}
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
  const searchOnRef = useRef(false);
  useEffect(() => { searchOnRef.current = searchOn; }, [searchOn]);
  /* Çoklu-ajan ("Ajan Ekibi") modu: planlayıcı → paralel işçiler → birleştirici. */
  /* Plan onayı: bir sonraki istekte plan-modu kapısını geçici aşar. */
  const planApprovedRef = useRef(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connectingRef = useRef(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [pendingCommit, setPendingCommit] = useState<EditorFile[] | null>(null);
  /* Ajanın bu turda yazdığı dosyaların ESKİ içeriği — "Geri al" için. */
  const [checkpoints, setCheckpoints] = useState<{ path: string; previous: string | null }[]>([]);
  const [undoing, setUndoing] = useState(false);
  /* Ajanın önerdiği YIKICI işlemler (sil/yeniden adlandır) — onay bekler. */
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prNumber, setPrNumber] = useState("");
  const [prLoading, setPrLoading] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  /* Akıllı oto-kaydırma: kullanıcı yukarı kaydırırsa yapışmayı bırak (Claude gibi). */
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const prevLenRef = useRef(0);
  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];
  const activeRepoStr = config.activeRepo || "";
  const repoIsGitLab = isGitLabRepo(activeRepoStr);

  /* Sohbet değişince / sayfa yenilenince: son asistan mesajına kalıcı yazılmış
     geri-al noktalarını yerel duruma geri yükle (Geri Al kaybolmasın). */
  useEffect(() => {
    const msgs = useStore.getState().current()?.messages ?? [];
    const last = msgs[msgs.length - 1];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckpoints(last?.role === "assistant" && last.checkpoints?.length ? last.checkpoints : []);
  }, [currentId]);

  useEffect(() => {
    if (pendingInput) {
      /* Drain a one-shot value pushed from the global store into the local
         composer; this is an external-store sync, so it belongs in an effect. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    /* Yeni mesaj eklendiyse (kullanıcı gönderdi/yanıt başladı) en alta yapış;
       akış sırasında token gelirken yalnızca kullanıcı zaten alttaysa kaydır. */
    const grew = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (grew) stickRef.current = true;
    if (stickRef.current) endRef.current?.scrollIntoView({ behavior: grew ? "smooth" : "auto" });
  }, [messages.length, lastMessageContent]);

  /* Sohbet değişince en alta yapış + scroll (yeni sohbet hep dipten başlasın). */
  useEffect(() => {
    stickRef.current = true;
    prevLenRef.current = messages.length;
    endRef.current?.scrollIntoView({ behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const connectRepo = async (silent = false) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
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
        try {
          const { branch, items } = await fetchRepoTree(parsed.owner, parsed.repo, token);
          setRepo({ ...parsed, branch });
          setTree(buildTree(items));
        } catch (ghErr) {
          /* GitHub'da bulunamadı → aynı namespace/repo'yu GitLab'da dene. Repolar
             GitLab'a taşındıysa kullanıcı `namespace/repo` yazınca da bağlanır
             (genel/public repolarda token gerekmez). */
          const gl = parseGitLabRepo(activeRepo);
          if (!gl) throw ghErr;
          try {
            const gtoken = store.activeGitlab()?.token;
            const { branch, items } = await fetchGitLabRepoTree(gl.namespace, gl.repo, gtoken);
            setRepo({ owner: gl.namespace, repo: gl.repo, branch });
            setTree(buildGitLabTree(items));
          } catch {
            /* İkisi de başarısız → token durumuna göre eyleme dönük hata. */
            if (!token) {
              throw new Error(
                `GitHub deposuna erişilemedi (${(ghErr as Error).message}). ÖZEL repo ise Ayarlar → Depolar'dan bir GitHub erişim token'ı (PAT, 'repo' kapsamı) ekle; GitLab deposuysa "gitlab.com/namespace/repo" biçiminde gir.`,
              );
            }
            throw new Error(
              `${(ghErr as Error).message}. Depo adı doğru mu, token 'repo' kapsamına sahip mi? GitLab deposuysa "gitlab.com/namespace/repo" biçiminde ekle.`,
            );
          }
        }
      }
      /* Repo bağlandı → ajan repoyu görebilsin diye tool-use'u otomatik aç.
         Kullanıcı daha önce BİLEREK kapatmadıysa (localStorage anahtarı yoksa). */
      if (typeof window !== "undefined" && localStorage.getItem("craftai_tools") === null) {
        useStore.getState().setToolsEnabled(true);
      }
    } catch (e) {
      /* Açılıştaki otomatik bağlanmada sessiz kal; sadece elle bağlanınca hata göster. */
      if (!silent) addToast(`Depo bağlantısı başarısız: ${(e as Error).message}`, "error");
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  };

  const prevActiveRepoRef = useRef(config.activeRepo);
  useEffect(() => {
    if (!config.activeRepo) return;
    const repoChanged = prevActiveRepoRef.current !== config.activeRepo;
    prevActiveRepoRef.current = config.activeRepo;
    // Clear stale tree when repo switches, then always reconnect
    if (repoChanged && tree) {
      setTree(null);
      setRepo(null);
    }
    if (!tree || repoChanged) connectRepo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeRepo, config.activeGithubId, config.activeGitlabId, config.cliMode]);

  useEffect(() => {
    if (!config.autoTerminal) return;
    import("@/lib/webcontainer").then(({ isSupported }) => {
      if (isSupported()) setTerminalOpen(true);
    });
  }, [config.autoTerminal]);

  /* Listen for terminal output events — auto-send to AI as follow-up context */
  useEffect(() => {
    const handler = (e: Event) => {
      const { command, output } = (e as CustomEvent<{ command: string; output: string }>).detail ?? {};
      if (!output) return;
      const msg = `**Terminal çıktısı** (\`${command}\`):\n\`\`\`\n${output}\n\`\`\``;
      useStore.getState().pushMessage({ role: "user", content: msg });
      /* callApi is a stable useCallback defined below; it's only invoked here
         from an event handler that fires after mount, so the forward ref is safe. */
      // eslint-disable-next-line react-hooks/immutability
      void callApi();
    };
    window.addEventListener("craftai:terminal-output", handler);
    return () => window.removeEventListener("craftai:terminal-output", handler);
  // callApi is stable (useCallback with no deps that change), safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* Komut paletinden (Cmd+P) dosya açma isteği → editörde aç. */
  useEffect(() => {
    const handler = async (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path;
      if (!path) return;
      const existing = attachedFiles.find((f) => f.path === path);
      if (existing) {
        setEditorFile({ path: existing.path, content: existing.content, language: detectLanguage(path) });
        setEditorOpen(true);
        return;
      }
      const file = tree ? getAllFiles(tree).find((f) => f.path === path) : undefined;
      if (file) await attachRepoFile(file);
    };
    window.addEventListener("craftai:open-file", handler);
    return () => window.removeEventListener("craftai:open-file", handler);
  // attachRepoFile kapanışı attachedFiles/tree ile yenilenir; diğerleri stabil
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedFiles, tree]);

  /* Geri al: ajanın bu turda değiştirdiği dosyaları eski içerikleriyle yeniden
     commit eder (revert); bu turda OLUŞTURULAN dosyaları (previous === null)
     siler. EditorPanel/MultiCommitBar ile aynı yazma/silme uçları. */
  const undoCheckpoints = async () => {
    if (!repo || checkpoints.length === 0) return;
    setUndoing(true);
    const store = useStore.getState();
    try {
      const token = repoIsGitLab ? store.activeGitlab()?.token : store.activeGithub()?.token;
      const idField = repoIsGitLab ? { namespace: repo.owner } : { owner: repo.owner };
      const base = { ...idField, repo: repo.repo, branch: repo.branch, token };
      for (const cp of checkpoints) {
        const isCreated = cp.previous === null;
        const endpoint = repoIsGitLab
          ? (isCreated ? "/api/gitlab/delete" : "/api/gitlab/write")
          : (isCreated ? "/api/github/delete" : "/api/github/write");
        const body = isCreated
          ? { ...base, path: cp.path, message: `revert: remove ${cp.path}` }
          : { ...base, path: cp.path, content: cp.previous, message: `revert: ${cp.path}` };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: `Hata ${res.status}` }));
          throw new Error(error);
        }
      }
      addToast(`↩ ${checkpoints.length} dosya eski haline döndürüldü`, "success");
      setCheckpoints([]);
      store.setCheckpointsOnLast([]);
      void store.persistCurrent();
    } catch (e) {
      addToast(`Geri alınamadı: ${(e as Error).message}`, "error");
    } finally {
      setUndoing(false);
    }
  };

  /* Yıkıcı işlem önerisini ONAYLA (uygula) veya REDDET. Silme/yeniden adlandırma
     yalnızca burada, kullanıcı tıklamasıyla gerçekleşir — ajan asla doğrudan yapamaz. */
  const resolvePendingAction = async (action: PendingAction, approve: boolean) => {
    if (!approve) { setPendingActions((p) => removePendingAction(p, action.id)); return; }
    if (!repo) return;
    setResolvingAction(action.id);
    const store = useStore.getState();
    const isGL = repoIsGitLab;
    const token = isGL ? store.activeGitlab()?.token : store.activeGithub()?.token;
    const idField = isGL ? { namespace: repo.owner } : { owner: repo.owner };
    const jbody = (extra: Record<string, unknown>) => JSON.stringify({ ...idField, repo: repo.repo, branch: repo.branch, token, ...extra });
    const post = async (url: string, extra: Record<string, unknown>) => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: jbody(extra) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `Hata ${res.status}` }))).error);
    };
    try {
      const delUrl = isGL ? "/api/gitlab/delete" : "/api/github/delete";
      const writeUrl = isGL ? "/api/gitlab/write" : "/api/github/write";
      if (action.kind === "delete") {
        await post(delUrl, { path: action.path, message: `delete: ${action.path}` });
        addToast(`🗑 ${action.path} silindi`, "success");
      } else {
        const content = isGL
          ? await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, action.path, token)
          : await fetchFileContent(repo.owner, repo.repo, repo.branch, action.path, token);
        await post(writeUrl, { path: action.newPath, content, message: `rename: ${action.path} → ${action.newPath}` });
        await post(delUrl, { path: action.path, message: `rename: remove ${action.path}` });
        addToast(`✏ ${action.path} → ${action.newPath}`, "success");
      }
      setPendingActions((p) => removePendingAction(p, action.id));
    } catch (e) {
      addToast(`İşlem başarısız: ${(e as Error).message}`, "error");
    } finally {
      setResolvingAction(null);
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

  /* Otomatik bellek: yanıt bittikten sonra arka planda son alışverişten kalıcı
     tercihleri damıt ve "🧠 Otomatik Bellek" skill'ine ekle. Gizli sohbetlerde
     ve ayar kapalıyken çalışmaz; hata ana akışı asla etkilemez. */
  const extractMemory = useCallback(async () => {
    const store = useStore.getState();
    if (store.config.autoMemory === false) return;
    const chat = store.current();
    if (!chat || chat.incognito) return;
    const active = store.activeModel();
    if (!active?.apiKey) return; // anahtarsız (Pollinations) uçta ekstra çağrı yapma
    const msgs = chat.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content ?? "";
    if (!lastUser.trim() || !lastAssistant.trim()) return;
    const existing = store.config.skills?.find((s) => s.id === "auto_memory")?.content ?? "";
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: lastUser, assistantText: lastAssistant, existing,
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey,
        }),
      });
      const { facts } = await res.json();
      if (Array.isArray(facts) && facts.length) {
        store.addAutoMemoryFacts(facts.filter((f: unknown): f is string => typeof f === "string"));
      }
    } catch { /* yoksay */ }
  }, []);

  const callApi = useCallback(async (
    overrideAgent?: Agent | null,
    opts?: { continuation?: boolean; depth?: number },
  ) => {
    const store = useStore.getState();
    let active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }

    /* Proje-başına model/örnekleme: aktif projenin ayarları global'i geçersiz kılar. */
    const activeProjectCfg = store.config.projects.find((p) => p.id === store.config.activeProjectId);
    if (activeProjectCfg?.modelId) {
      const override = store.config.models.find((m) => m.id === activeProjectCfg.modelId);
      if (override) active = override;
    }

    const chat = store.current();
    const lastUserMsg = chat?.messages.findLast?.((m) => m.role === "user");
    const messageAgentId = lastUserMsg?.agentId;
    const agent =
      overrideAgent !== undefined
        ? overrideAgent
        : messageAgentId
        ? AGENTS.find((a) => a.id === messageAgentId) ?? null
        : null;

    /* Devam modu (Claude Code tarzı): kesilen asistan yanıtı YENİ baloncuk
       açmadan, aynı mesajın içinden sürdürülür. Sohbete görünür bir kullanıcı
       mesajı eklenmez; talimat yalnızca API isteğine iliştirilir. */
    const lastMsg = chat?.messages[chat.messages.length - 1];
    const isContinuation = !!opts?.continuation && lastMsg?.role === "assistant" && !!lastMsg.content;

    const rawMessages = (chat?.messages ?? []).map((m) => {
      if (m.images?.length) {
        const content: unknown[] = m.images.map((img) => ({ type: "image_url", image_url: { url: img } }));
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });
    if (isContinuation) {
      rawMessages.push({
        role: "user",
        content:
          "[Devam] Önceki yanıtın token sınırında kesildi. Tam kaldığın yerden sür: " +
          "kesilen cümlenin/kod bloğunun ortasından devam et, önceki metni TEKRARLAMA, " +
          "selamlama veya giriş cümlesi YAZMA, açık kalan markdown/kod bloğu yapısını koru.",
      });
    }
    /* Context window management: keep last 24 messages to avoid token overflow */
    const MAX_CTX = 24;
    const apiMessages = rawMessages.length > MAX_CTX
      ? [
          { role: "system" as const, content: `[Bağlam notu: Bu sohbet ${rawMessages.length} mesaj içeriyor. Token sınırı nedeniyle yalnızca son ${MAX_CTX} mesaj gönderiliyor.]` },
          ...rawMessages.slice(-MAX_CTX),
        ]
      : rawMessages;

    const activeProject = config.projects.find((p) => p.id === config.activeProjectId);
    const coderSystemPrompt = [
      config.systemPrompt,
      agent
        ? agent.systemPrompt
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun.",
      activeProject?.systemPrompt?.trim() ? `## Proje: ${activeProject.name}\n${activeProject.systemPrompt.trim()}` : "",
      config.rulesFile?.trim() ? `## Proje Kuralları (.rules)\n${config.rulesFile.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!isContinuation) store.pushMessage({ role: "assistant", content: "" });
    store.setFinishReasonOnLast(undefined); // bayatlamış "kesildi" şeridini temizle
    store.setStreaming(true);
    if (!isContinuation) setCheckpoints([]); // yeni tur — önceki turun geri-al noktaları sıfırlanır
    const turnCheckpoints: { path: string; previous: string | null }[] =
      isContinuation ? [...(lastMsg?.checkpoints ?? [])] : []; // devamda önceki yazmalar korunur
    setPendingActions([]); // bekleyen yıkıcı işlem önerileri
    store.setFollowUpSuggestions([]);
    coderAbort = new AbortController();
    const abortCtl = coderAbort;

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

    /* Web search pre-fetch: when searchOn, fetch Jina results before sending to AI */
    let webSearchContext = "";
    if (searchOnRef.current) {
      const userQuery = lastUserMsg?.content ?? "";
      try {
        const wsr = await fetch(`/api/web-search?q=${encodeURIComponent(userQuery)}`, {
          signal: AbortSignal.timeout(12000),
        });
        if (wsr.ok) webSearchContext = await wsr.text();
      } catch { /* ignore — continue without search */ }
    }

    /* Devam modunda full mevcut içerikten başlar → akış aynı baloncuğa eklenir. */
    const priorLen = isContinuation ? (lastMsg?.content.length ?? 0) : 0;
    let full = isContinuation ? (lastMsg?.content ?? "") : ""; // try/catch ortak erişimi
    let cutAtLength = false; // finish_event: "length" ⇒ otomatik devam tetiklenebilir
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
      /* Sunucu-proxy üzerinden çağrı (tüm sağlayıcılar için ortak; Pollinations
         doğrudan tarayıcı çağrısı başarısız olursa yedek olarak da kullanılır.
         Sunucu Pollinations'ı anahtarsız destekler). */
      /* Ajan Ekibi modunda orkestrasyon endpoint'ine git (planlayıcı → paralel
         işçiler → birleştirici). Aynı gövdeyi alır, aynı OpenAI-uyumlu SSE'yi döner. */
      const endpoint = "/api/chat";
      const callViaServer = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtl.signal,
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
          webSearch: searchOnRef.current,
          requireWriteApproval: store.config.requireWriteApproval,
          planApprovalMode: store.config.planApprovalMode,
          planApproved: planApprovedRef.current,
          blockNetworkTools: store.config.blockNetworkTools,
          temperature: activeProjectCfg?.temperature,
          maxTokens: activeProjectCfg?.maxTokens,
          searchContext: webSearchContext || undefined,
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

      /* Pollinations: tarayıcıdan doğrudan çağrı yapılır (her kullanıcı kendi IP'sini kullanır,
         sunucu IP'si paylaşıldığında oluşan rate-limit sorunu önlenir). CORS açık. */
      let res: Response;
      /* Pollinations'ı yalnızca DÜZ sohbette doğrudan tarayıcıdan çağır (hızlı +
         kullanıcının kendi IP'si). Araç-kullanımı/web-arama TOOL-LOOP gerektirir
         → bunlar sunucu-proxy'ye gider (yoksa araçlar sessizce çalışmaz, model
         repodan habersiz kalır). */
      if (active.provider === "pollinations" && !toolsEnabled && !searchOnRef.current) {
        /* Bağlam blokları sunucu (/api/chat) ile ORTAK tek kaynaktan gelir →
           Pollinations kullanıcıları da aynı, eksiksiz bağlamı alır. PLATFORM_KNOWLEDGE
           eklenir ki bu sağlayıcıdaki model de platformun farkında olsun. */
        const sysContent = finalSystemPrompt + "\n\n" + PLATFORM_KNOWLEDGE + buildContextSections({
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills,
          searchContext: webSearchContext || undefined,
        });
        /* `referrer`: Pollinations anonim (referrer'sız) istekleri en agresif
           kısıtlar. Sabit bir referrer eklemek daha yüksek limitli kovaya alır. */
        const makePolBody = (modelName: string) => JSON.stringify({
          model: modelName,
          messages: [{ role: "system", content: sysContent }, ...apiMessages],
          stream: true,
          referrer: "craft-coder",
        });
        /* Cycle through models on 429: try each for up to 2 attempts before moving on.
           Order: selected → openai → mistral → llama (least to most likely available) */
        const startModel = active.model === "openai-fast" ? "openai" : active.model;
        const POL_FALLBACKS = ["openai", "mistral", "llama"].filter((m) => m !== startModel);
        const polQueue = [startModel, ...POL_FALLBACKS];
        let polModel = polQueue.shift()!;
        let polAttempt = 0;
        const POL_WAIT = 3000;
        /* Opsiyonel ücretsiz Pollinations token'ı (Ayarlar'da model anahtarı
           alanına yapıştırılırsa) limiti yükseltir; yoksa anonim denenir. */
        const polHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (active.apiKey) polHeaders["Authorization"] = `Bearer ${active.apiKey}`;
        try {
          while (true) {
            res = await fetch(`${active.baseUrl}/chat/completions`, {
              method: "POST",
              headers: polHeaders,
              signal: abortCtl.signal,
              body: makePolBody(polModel),
            });
            if (res.status !== 429) break;
            if (polAttempt < 1) {
              polAttempt++;
              addToast(`Pollinations yoğun, ${POL_WAIT / 1000}s sonra tekrar deneniyor...`, "info");
              await new Promise<void>((resolve) => {
                const t = setTimeout(resolve, POL_WAIT);
                abortCtl.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
              });
              if (abortCtl.signal.aborted) throw new DOMException("Aborted", "AbortError");
            } else if (polQueue.length > 0) {
              polModel = polQueue.shift()!;
              polAttempt = 0;
              addToast(`Alternatif model deneniyor: ${polModel}...`, "info");
            } else {
              break;
            }
          }
          /* Doğrudan çağrı 429 dışı bir hatayla döndüyse (ör. CORS politikası,
             5xx, kimlik katmanı) sunucu-proxy'ye düş — orada anahtarsız çalışır. */
          if (!res.ok && res.status !== 429) {
            res = await callViaServer();
          }
        } catch (err) {
          /* İptal edildiyse yukarı fırlat; ağ/CORS hatasıysa sunucu-proxy'ye düş. */
          if ((err as Error)?.name === "AbortError") throw err;
          res = await callViaServer();
        }
      } else {
        res = await callViaServer();
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429) {
          if (active.provider === "pollinations") {
            throw new Error(
              `⏱️ Pollinations (ücretsiz) şu an yoğun ve isteğini sınırladı [${active.model}]. ` +
              `Birkaç dakika sonra tekrar dene **ya da** kesintisiz kullanım için Ayarlar → Modeller'den ücretsiz bir anahtar ekle ` +
              `(Google Gemini günde 1.5M istek, Groq veya OpenRouter ücretsiz modeller).`,
            );
          }
          throw new Error(`⏱️ İstek limiti aşıldı [${active.provider} / ${active.model}]: 30-60 saniye bekle ve tekrar dene.`);
        }
        throw new Error(detail || `Hata ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
                  startedAt: Date.now(),
                });
              } else if (ev.phase === "end") {
                useStore.getState().updateToolCallOnLast(ev.id, {
                  result: ev.result, status: "done",
                  endedAt: Date.now(),
                });
              }
              continue;
            }
            /* ajan plan (update_plan) olayı */
            if (parsed.plan_event) {
              useStore.getState().setPlanOnLast(String(parsed.plan_event.plan ?? ""));
              continue;
            }
            /* bitiş nedeni: "length" ⇒ token sınırında kesildi → şerit + oto-devam */
            if (parsed.finish_event) {
              const reason = String(parsed.finish_event.reason ?? "");
              if (reason === "length") cutAtLength = true;
              useStore.getState().setFinishReasonOnLast(reason && reason !== "stop" ? reason : undefined);
              continue;
            }
            /* checkpoint: ajan bir dosyayı değiştirdi → eski içeriği sakla (geri al).
               previous === null ⇒ dosya bu turda oluşturuldu (geri al = sil). */
            if (parsed.checkpoint_event) {
              const { path, previous } = parsed.checkpoint_event;
              if (typeof path === "string" && (typeof previous === "string" || previous === null)) {
                setCheckpoints((prev) =>
                  prev.some((c) => c.path === path) ? prev : [...prev, { path, previous }],
                );
                if (!turnCheckpoints.some((c) => c.path === path)) {
                  turnCheckpoints.push({ path, previous });
                }
              }
              continue;
            }
            /* toplu commit tamamlandı */
            if (parsed.batch_commit_event) {
              const ev = parsed.batch_commit_event;
              if (ev?.result?.startsWith("✅")) {
                addToast(`${ev.result}`, "success");
              }
              continue;
            }
            /* yıkıcı işlem önerisi (sil/yeniden adlandır) → onay bekler */
            if (parsed.pending_action_event) {
              const ev = parsed.pending_action_event;
              if (ev?.kind === "delete" && ev.path) {
                setPendingActions((prev) => addPendingAction(prev, { id: ev.id, kind: "delete", path: ev.path, reason: ev.reason }));
              } else if (ev?.kind === "rename" && ev.path && ev.newPath) {
                setPendingActions((prev) => addPendingAction(prev, { id: ev.id, kind: "rename", path: ev.path, newPath: ev.newPath, reason: ev.reason }));
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

      /* Güvenli oto-çalıştır: yalnızca allowlist'teki komut otomatik terminale
         gönderilir (çıktı AI'ya beslenir → güvenli oto-düzelt). Diğerleri elle. */
      if (useStore.getState().config.autoRunCommands) {
        const allow = useStore.getState().config.commandAllowlist ?? DEFAULT_COMMAND_ALLOWLIST;
        const bashM = /```(?:bash|sh|shell|zsh)\n([\s\S]*?)```/.exec(full);
        const cmd = bashM?.[1]?.trim().split("\n")[0]?.trim();
        if (cmd && isCommandAllowed(cmd, allow)) {
          window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: cmd } }));
          addToast(`▶ Otomatik çalıştırıldı: ${cmd}`, "info");
        }
      }

      /* HTML / SVG / CSS içeren yanıtı canvas'ta otomatik önizle */
      const directM = /```(html|svg|mermaid)(?::[^\n]*)?\n([\s\S]*?)```/.exec(full);
      if (directM) {
        useStore.getState().setArtifact({
          type: directM[1] as "html" | "svg" | "mermaid",
          content: directM[2],
          title: `${directM[1].toUpperCase()} Önizleme`,
        });
      } else {
        const cssM = /```css(?::[^\n]*)?\n([\s\S]*?)```/.exec(full);
        if (cssM) {
          useStore.getState().setArtifact({
            type: "html",
            content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${cssM[1]}</style></head><body></body></html>`,
            title: "CSS Önizleme",
          });
        }
      }

      /* token tahmini (devamda yalnızca yeni üretilen kısım sayılır) */
      const inputText = apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join("\n");
      const tokenIn = estimateTokens(inputText) + estimateTokens(coderSystemPrompt);
      const tokenOut = estimateTokens(full.slice(priorLen));
      useStore.getState().updateLastTokens(tokenIn, tokenOut);
      /* geri-al noktalarını mesaja yaz → persistCurrent ile sohbetle kaydedilir,
         sayfa yenilense bile son turun "Geri Al" imkânı kaybolmaz */
      if (turnCheckpoints.length) useStore.getState().setCheckpointsOnLast(turnCheckpoints);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        /* Kullanıcı durdurdu: hiç içerik gelmediyse boş asistan baloncuğunu kaldır. */
        if (!full) useStore.getState().popLastMessage();
      } else {
        useStore.getState().updateLastContent(`**Hata:** ${(err as Error).message}\n\n_Anahtar/model doğru mu? Ayarlardan kontrol et._`);
      }
    } finally {
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      if (useStore.getState().config.soundEnabled) {
        const { playReady, notifyReady } = await import("@/lib/sounds");
        playReady();
        notifyReady("Craft.Coder", "Yanıt hazır.");
      }
      fetchFollowUps();
      void extractMemory();
    }
    /* Otomatik devam (Claude Code gibi): yanıt token sınırında kesildiyse aynı
       baloncuk içinden kendiliğinden sürdür — kullanıcı tıklamasına gerek yok.
       Sonsuz döngüye karşı en çok 2 ardışık otomatik devam. */
    const depth = opts?.depth ?? 0;
    if (cutAtLength && useStore.getState().config.autoContinue !== false && depth < 2 && !abortCtl.signal.aborted) {
      useStore.getState().addToast("Yanıt sınırda kesildi — kaldığı yerden devam ediliyor…", "info");
      await callApi(overrideAgent, { continuation: true, depth: depth + 1 });
    }
  /* callApi reads the rest of its inputs live via useStore.getState() during
     streaming, so it deliberately keeps a minimal dep set — recreating it on
     every config change would break in-flight requests. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.systemPrompt, fetchFollowUps, extractMemory]);

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
  /* Devam et (Claude Code tarzı): sohbete görünür mesaj eklemeden, kesilen
     asistan yanıtını AYNI baloncuğun içinden sürdürür. */
  const continueLast = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    const last = chat?.messages[chat.messages.length - 1];
    if (!chat || !last || last.role !== "assistant" || !last.content) return;
    await callApi(undefined, { continuation: true });
  };

  const editAndResend = async (index: number, content: string) => {
    /* Non-destructive: eski sürümü dal olarak korur, yeni dalı açıp regenere eder. */
    useStore.getState().editMessageBranch(index, content);
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
          <span className="text-sm font-semibold text-ink">Craft<span className="brand-text">.Coder</span></span>
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
            onClick={() => setEditorOpen((v) => !v)}
            title="IDE'yi aç/kapat"
            className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${editorOpen ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"}`}
          >
            <Code2 size={14} />
          </button>
          <ThinkingModeToggle />
          {/* Birleşik ⋯ menüsü: Terminal · Git · PR · Skills · Dışa aktar */}
          <MoreMenu placement="bottom" active={terminalOpen || gitPanelOpen}>
            <MoreItem
              icon={<Terminal size={14} />}
              label={terminalSupported ? (terminalOpen ? "Terminal'i kapat" : "Terminal") : "Terminal (masaüstü Chrome/Edge)"}
              active={terminalOpen}
              onClick={() => setTerminalOpen((v) => !v)}
            />
            <MoreItem icon={<GitBranch size={14} />} label="Git (dal, PR)" active={gitPanelOpen} onClick={() => setGitPanelOpen((v) => !v)} />
            {repo && <MoreItem icon={<GitPullRequest size={14} />} label="PR / MR incele" onClick={() => setPrModalOpen(true)} />}
            <MoreItem icon={<Zap size={14} />} label="Skills" onClick={() => useStore.getState().setSkillsOpen(true)} />
            {current && messages.length > 0 && (
              <>
                <div className="h-px bg-line/60 my-1 mx-1" />
                <MoreItem icon={<Download size={14} />} label="Markdown indir" onClick={() => useStore.getState().exportChat(current.id)} />
                <MoreItem icon={<Download size={14} />} label="HTML indir" onClick={() => useStore.getState().exportChatHtml(current.id)} />
                <MoreItem icon={<Download size={14} />} label="JSON indir" onClick={() => useStore.getState().exportChatJson(current.id)} />
                <MoreItem icon={<Copy size={14} />} label="Markdown kopyala" onClick={() => useStore.getState().copyChatMarkdown(current.id)} />
              </>
            )}
          </MoreMenu>
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
                  <button onClick={() => connectRepo()} disabled={connecting} title="Yenile" className="text-muted/40 hover:text-brand transition-colors">
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
                    {connecting ? "Yükleniyor…" : config.activeRepo ? config.activeRepo : "Depo seç veya ekle"}
                  </p>
                  {!connecting && (
                    <div className="flex flex-col gap-1.5 items-center">
                      {config.activeRepo ? (
                        <button onClick={() => connectRepo()} className="text-[10px] px-3 py-1.5 rounded-lg bg-brand text-white font-semibold hover:bg-branddim transition-colors flex items-center gap-1">
                          <FolderGit2 size={10} /> Bağlan
                        </button>
                      ) : null}
                      <button onClick={() => setSettingsOpen(true)} className="text-[10px] px-2 py-1 rounded-lg bg-brand/10 border border-brand/25 text-brand font-medium hover:bg-brand/20 transition-colors">
                        Ayarlar
                      </button>
                    </div>
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
          <div ref={scrollRef} onScroll={onMessagesScroll} className="flex-1 overflow-y-auto">
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
                        streamingNow={isLastAssistant && streaming}
                        onEdit={m.role === "user" ? editAndResend : undefined}
                        onSwitchVersion={
                          m.branches && m.branches.length > 1
                            ? (bIdx: number) => useStore.getState().switchMessageVersion(i, bIdx)
                            : undefined
                        }
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
                      {isLastAssistant && !streaming && config.planApprovalMode && m.plan && (
                        <div className="ml-11 max-w-2xl mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/30 bg-brand/5 text-xs">
                          <ListChecks size={13} className="text-brand shrink-0" />
                          <span className="text-muted flex-1">Plan hazır. Onaylarsan ajan uygulamaya başlar.</span>
                          <button
                            onClick={async () => {
                              planApprovedRef.current = true;
                              useStore.getState().pushMessage({ role: "user", content: "Planı onaylıyorum, uygula." });
                              try { await callApi(); } finally { planApprovedRef.current = false; }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand text-white hover:bg-branddim font-semibold transition-colors shrink-0"
                          >
                            <Check size={12} /> Onayla &amp; Uygula
                          </button>
                        </div>
                      )}
                      {isLastAssistant && !streaming && pendingActions.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl mt-2 rounded-xl border border-red/40 bg-red/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-red/20 text-xs">
                            <Trash2 size={13} className="text-red shrink-0" />
                            <span className="font-semibold text-red">Onay gerekli — ajan {pendingActions.length} yıkıcı işlem öneriyor</span>
                          </div>
                          <div className="divide-y divide-line/40">
                            {pendingActions.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate font-mono">
                                    {a.kind === "delete" ? `Sil: ${a.path}` : `Taşı: ${a.path} → ${a.newPath}`}
                                  </span>
                                  {a.reason && <span className="block truncate text-muted/60">{a.reason}</span>}
                                </span>
                                <button
                                  onClick={() => resolvePendingAction(a, true)}
                                  disabled={resolvingAction === a.id}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red/15 text-red hover:bg-red/25 font-semibold disabled:opacity-50 transition-colors shrink-0"
                                >
                                  {resolvingAction === a.id ? <Loader2Icon size={12} className="animate-spin" /> : <Check size={12} />}
                                  Onayla
                                </button>
                                <button
                                  onClick={() => resolvePendingAction(a, false)}
                                  disabled={resolvingAction === a.id}
                                  className="px-2.5 py-1 rounded-lg text-muted hover:text-ink hover:bg-bgsoft font-semibold disabled:opacity-50 transition-colors shrink-0"
                                >
                                  Reddet
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isLastAssistant && !streaming && checkpoints.length > 0 && repo && (
                        <div className="ml-11 max-w-2xl mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft/50 text-xs">
                          <RotateCcw size={13} className="text-amber-400 shrink-0" />
                          <span className="text-muted flex-1 min-w-0 truncate">
                            Ajan {checkpoints.length} dosyayı değiştirdi
                            {checkpoints.length === 1 ? ` (${checkpoints[0].path})` : ""}
                          </span>
                          <button
                            onClick={undoCheckpoints}
                            disabled={undoing}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 font-semibold disabled:opacity-50 transition-colors shrink-0"
                          >
                            {undoing ? <Loader2Icon size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                            {undoing ? "Geri alınıyor…" : "Geri Al"}
                          </button>
                          <button
                            onClick={() => {
                              setCheckpoints([]);
                              useStore.getState().setCheckpointsOnLast([]);
                              void useStore.getState().persistCurrent();
                            }}
                            className="text-muted/50 hover:text-ink p-1 rounded transition-colors shrink-0"
                            title="Kapat"
                          >
                            <X size={12} />
                          </button>
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
                      {/* User-attached preview is a base64 data URI; next/image can't optimize it. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
                  <ComposerButton onClick={() => setFilesOpen((v) => !v)} active={filesOpen} title="Depo dosyaları">
                    <FolderOpen size={13} />
                    <span>Dosyalar</span>
                  </ComposerButton>
                  <ComposerButton onClick={() => fileRef.current?.click()} title="Dosya ekle">
                    <Paperclip size={13} />
                    <span>Ekle</span>
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
                  <MoreMenu active={!!artifact || !!activeAgent || searchOn}>
                    <MoreItem icon={<Globe size={14} />} label="Web arama" active={searchOn} onClick={() => setSearchOn(!searchOn)} />
                    <MoreItem icon={<ImageIcon size={14} />} label="Görsel ekle" onClick={() => imgRef.current?.click()} />
                    <MoreItem
                      icon={<Palette size={14} />}
                      label="Canvas önizleme"
                      active={!!artifact}
                      onClick={() => {
                        const msgs = useStore.getState().current()?.messages ?? [];
                        for (let i = msgs.length - 1; i >= 0; i--) {
                          const content = msgs[i].content;
                          if (!content) continue;
                          const directMatch = /```(?:html|svg|mermaid)(?::[^\n]*)?\n([\s\S]*?)```/.exec(content);
                          if (directMatch) {
                            const lang = /```(html|svg|mermaid)/.exec(content)?.[1] ?? "html";
                            useStore.getState().setArtifact({ type: lang as "html" | "svg" | "mermaid", content: directMatch[1], title: `${lang.toUpperCase()} Önizleme` });
                            return;
                          }
                          const cssMatch = /```css(?::[^\n]*)?\n([\s\S]*?)```/.exec(content);
                          if (cssMatch) {
                            useStore.getState().setArtifact({ type: "html", content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${cssMatch[1]}</style></head><body></body></html>`, title: "CSS Önizleme" });
                            return;
                          }
                          const jsMatch = /```(?:javascript|js|jsx|ts|tsx)(?::[^\n]*)?\n([\s\S]*?)```/.exec(content);
                          if (jsMatch) {
                            useStore.getState().setArtifact({ type: "html", content: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>${jsMatch[1]}<\/script></body></html>`, title: "JS Önizleme" });
                            return;
                          }
                        }
                        addToast("Önizlenecek HTML, SVG, CSS veya Mermaid kodu bulunamadı", "info");
                      }}
                    />
                    <MoreItem
                      icon={<BookOpen size={14} />}
                      label="Kütüphane"
                      onClick={() => { useStore.getState().setLibraryTab("snippets"); useStore.getState().setLibraryOpen(true); }}
                    />
                  </MoreMenu>
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
      const store = useStore.getState();
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

