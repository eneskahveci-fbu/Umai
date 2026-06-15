"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Circle,
  CircleCheck,
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
  Sparkles,
  Trash2,
  Square,
  Terminal,
  DollarSign,
  ShieldCheck,
  Users,
  VenetianMask,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { detectLanguage, type EditorFile } from "@/lib/editor";
import { extractAllFileFences } from "@/lib/parsers";
import { fuzzyFiles } from "@/lib/fuzzy";
import { buildPreview } from "@/lib/preview";

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
import { ALL_AGENTS, findAgentByCommand, stripCommand, type Agent } from "@/lib/agents";
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
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted/50 px-2 pt-1 pb-1.5">Efor Seviyesi</div>
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
        title="Efor seviyesi"
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

/* Ham hata mesajını kullanıcının anlayacağı, çözüm önerili Türkçe metne çevirir.
   Tanınmayan hatalarda orijinal mesaj korunur. */
function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (/(401|403|unauthorized|invalid api key|invalid_api_key|authentication)/.test(m))
    return "Geçersiz veya eksik API anahtarı. Ayarlar → Modeller'den anahtarını kontrol et.";
  if (/(429|rate limit|too many requests|quota|insufficient_quota)/.test(m))
    return "İstek sınırına (rate limit) takıldın veya kotan bitti. Biraz bekle ya da başka bir model/sağlayıcı dene.";
  if (/(timeout|timed out|etimedout|deadline)/.test(m))
    return "İstek zaman aşımına uğradı. Bağlantını kontrol et ve tekrar dene; istek çok uzunsa kısaltmayı dene.";
  if (/(failed to fetch|network|networkerror|err_network|connection|econnrefused|fetch failed)/.test(m))
    return "Ağ/bağlantı sorunu. İnternetini kontrol et; sağlayıcı erişilemiyor olabilir.";
  if (/(404|not found|model.*(not found|does not exist)|unknown model)/.test(m))
    return "Model bulunamadı. Ayarlar'dan model adının doğru yazıldığından emin ol.";
  if (/(500|502|503|529|overloaded|service unavailable|server error)/.test(m))
    return "Sağlayıcı şu an yoğun veya geçici olarak yanıt vermiyor. Birkaç saniye sonra tekrar dene.";
  return raw;
}


let coderAbort: AbortController | null = null;

type AttachedFile = { path: string; content: string };

/* ── FileTree ── */
function FileTreeNode({
  node, prefix = "", onSelect, attached, onContextMenu,
}: {
  node: TreeNode; prefix?: string; onSelect: (f: TreeFile) => void; attached: string[];
  onContextMenu?: (f: TreeFile, e: React.MouseEvent) => void;
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
            {isOpen && <FileTreeNode node={child} prefix={key + "/"} onSelect={onSelect} attached={attached} onContextMenu={onContextMenu} />}
          </div>
        );
      })}
      {node.files.map((f) => {
        const isAttached = attached.includes(f.path);
        return (
          <button
            key={f.path}
            onClick={() => onSelect(f)}
            onContextMenu={(e) => { if (onContextMenu) { e.preventDefault(); onContextMenu(f, e); } }}
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

/* Anlamsal indekse alınacak metin/kod uzantıları ve üst sınır. */
const RAG_TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|c|h|cpp|cs|css|scss|html|json|md|mdx|txt|yml|yaml|sh|sql)$/i;
const RAG_MAX_FILES = 150;

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
  /* Terminal bir kez boot olur ve ARKAPLANDA mount kalır (kapatınca unmount
     olmaz) → ajan run_command'ları her zaman çalışır; buton sadece görünürlüğü
     açıp kapatır. */
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [terminalSupported, setTerminalSupported] = useState(true);
  /* Terminal "hazır" mı? run_command komutunu erken gönderip kaybetmemek için izlenir. */
  const terminalReadyRef = useRef(false);
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
  /* Çoklu-ajan ("Ajan Ekibi" / Swarm) modu: planlayıcı → paralel uzman işçiler
     → birleştirici (/api/orchestrate). Tek mesajda bir ajan ekibi çalışır. */
  const [swarmMode, setSwarmMode] = useState(false);
  const swarmModeRef = useRef(false);
  useEffect(() => { swarmModeRef.current = swarmMode; }, [swarmMode]);
  /* Plan onayı: bir sonraki istekte plan-modu kapısını geçici aşar. */
  const planApprovedRef = useRef(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connectingRef = useRef(false);
  const [fetchingFile, setFetchingFile] = useState<string | null>(null);
  /* Anlamsal (RAG) arama — transformers.js gömme indeksi (repo+branch ile önbellek). */
  const [semanticMode, setSemanticMode] = useState(false);
  const [ragHits, setRagHits] = useState<import("@/lib/rag").RagHit[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragProgress, setRagProgress] = useState<{ done: number; total: number } | null>(null);
  const ragIndexRef = useRef<{ key: string; index: import("@/lib/rag").SemanticIndex } | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [pendingCommit, setPendingCommit] = useState<EditorFile[] | null>(null);
  /* Ajanın bu turda yazdığı dosyaların ESKİ içeriği — "Geri al" için. */
  const [checkpoints, setCheckpoints] = useState<{ path: string; previous: string | null }[]>([]);
  const [undoing, setUndoing] = useState(false);
  /* Ajanın önerdiği YIKICI işlemler (sil/yeniden adlandır) — onay bekler. */
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  /* Çoklu dosya sekmeleri: editörde açık tutulan dosyalar + aktif olanın
     kaydedilmemiş durumu (sekme geçişinde veri kaybını önlemek için). */
  const [openTabs, setOpenTabs] = useState<EditorFile[]>([]);
  const [activeDirty, setActiveDirty] = useState(false);
  /* Dosya ağacı sağ-tık menüsü konumu + hedef dosya. */
  const [treeMenu, setTreeMenu] = useState<{ x: number; y: number; file: TreeFile } | null>(null);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);

  /* Dosyayı editörde aç: sekme yoksa ekle, varsa içeriğini güncelle, aktif yap. */
  const openInEditor = (f: EditorFile) => {
    setEditorFile(f);
    setEditorOpen(true);
    setActiveDirty(false);
    setOpenTabs((tabs) => {
      const i = tabs.findIndex((t) => t.path === f.path);
      if (i === -1) return [...tabs, f];
      const next = [...tabs];
      next[i] = f;
      return next;
    });
  };
  /* Sekmeye geç — aktif sekmede kaydedilmemiş değişiklik varsa onay iste. */
  const selectTab = (path: string) => {
    if (path === editorFile?.path) return;
    if (activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) return;
    const t = openTabs.find((x) => x.path === path);
    if (t) { setEditorFile(t); setEditorOpen(true); setActiveDirty(false); }
  };
  /* Sekmeyi kapat — aktif ve kirliyse onay iste, komşu sekmeye geç. */
  const closeTab = (path: string) => {
    const isActive = path === editorFile?.path;
    if (isActive && activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Sekme kapatılsın mı?")) return;
    setOpenTabs((tabs) => {
      const idx = tabs.findIndex((t) => t.path === path);
      const next = tabs.filter((t) => t.path !== path);
      if (isActive) {
        if (next.length === 0) { setEditorFile(null); setEditorOpen(false); }
        else { setEditorFile(next[Math.max(0, idx - 1)]); setActiveDirty(false); }
      }
      return next;
    });
  };
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 120;
    setShowScrollDown(dist > 300);
  };
  const scrollToBottom = () => {
    stickRef.current = true;
    setShowScrollDown(false);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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

  /* Proje değişince, projeye bağlı varsayılan repo varsa onu aktif et
     (yukarıdaki efekt repo bağlantısını otomatik kurar). */
  const prevProjRepoRef = useRef(config.activeProjectId);
  useEffect(() => {
    if (prevProjRepoRef.current === config.activeProjectId) return;
    prevProjRepoRef.current = config.activeProjectId;
    const proj = config.projects.find((p) => p.id === config.activeProjectId);
    if (proj?.repo && proj.repo !== config.activeRepo) {
      const st = useStore.getState();
      st.saveConfig({ ...st.config, activeRepo: proj.repo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeProjectId]);

  /* Terminalde komut çalıştır (arkaplanda hazırlar, hazır olunca gönderir).
     Hem ajan run_command'ı hem de otomasyonlar bunu kullanır. */
  const runInTerminal = (command: string) => {
    const cmd = command.trim();
    if (!cmd) return;
    setTerminalMounted(true);
    useStore.getState().addCommandRun(cmd);
    const fire = () => window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: cmd } }));
    if (terminalReadyRef.current) { fire(); return; }
    let done = false;
    const onReady = () => {
      if (done) return; done = true;
      window.removeEventListener("craftai:terminal-ready", onReady);
      fire();
    };
    window.addEventListener("craftai:terminal-ready", onReady);
    setTimeout(onReady, 20000);
  };

  /* Bir REPO bağlanınca terminali HER ZAMAN ARKAPLANDA boot et (gizli) → ajan
     komutları hazır olur; repo yokken boşa kaynak harcanmaz. Ön plana ASLA
     kendiliğinden açılmaz; kullanıcı isterse butonla açar. Komut çıktıları
     sohbette "Terminal" todo kutusunda görünür. Bir kez mount olunca kapanmaz. */
  useEffect(() => {
    if (!repo) return;
    const useWs = !!config.terminalWsUrl?.trim();
    /* Varsayılan: yalnızca arkaplanda mount (ön plana açılmaz). Kullanıcı
       ayarlardan "Terminal panelini otomatik aç"ı açıkça seçerse ön plana da gelir. */
    const mount = () => { setTerminalMounted(true); if (config.autoTerminal) setTerminalOpen(true); };
    if (useWs) { const id = setTimeout(mount, 0); return () => clearTimeout(id); }
    let alive = true;
    import("@/lib/webcontainer").then(({ isSupported }) => { if (alive && isSupported()) mount(); });
    return () => { alive = false; };
  }, [repo, config.autoTerminal, config.terminalWsUrl]);

  /* Terminal hazır olduğunda işaretle; kapanınca sıfırla → run_command'ı doğru anda gönder. */
  useEffect(() => {
    const onReady = () => { terminalReadyRef.current = true; };
    window.addEventListener("craftai:terminal-ready", onReady);
    return () => window.removeEventListener("craftai:terminal-ready", onReady);
  }, []);
  /* Terminal arkaplanda mount kaldığı için kapatınca 'ready' sıfırlanmaz —
     yalnızca tamamen unmount olursa (terminalMounted=false). */
  useEffect(() => { if (!terminalMounted) terminalReadyRef.current = false; }, [terminalMounted]);

  /* Listen for terminal output events — auto-send to AI as follow-up context */
  useEffect(() => {
    const handler = (e: Event) => {
      const { command, output } = (e as CustomEvent<{ command: string; output: string }>).detail ?? {};
      if (!output) return;
      /* Çıktıyı "Terminal" todo kutusuna yaz (ayrı balon yok). */
      useStore.getState().setCommandOutput(command, output, "done");
      /* AI'ya bağlam olarak besle — bu kullanıcı mesajı sohbette GİZLENİR
         (MessageBubble "**Terminal çıktısı**" ile başlayanları render etmez);
         çıktı zaten todo kutusunda görünür. */
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
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* Sağ-tık menüsü: dosyayı sohbete eklemeden yalnızca editörde aç. */
  const openTreeFile = async (file: TreeFile) => {
    const existing = attachedFiles.find((f) => f.path === file.path);
    if (existing) {
      openInEditor({ path: file.path, content: existing.content, language: detectLanguage(file.path) });
      return;
    }
    if (!repo) return;
    setFetchingFile(file.path);
    try {
      const store = useStore.getState();
      const activeRepo = store.config.activeRepo || "";
      const content = isGitLabRepo(activeRepo)
        ? await fetchGitLabFileContent(repo.owner, repo.repo, repo.branch, file.path, store.activeGitlab()?.token)
        : await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, store.activeGithub()?.token);
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setFetchingFile(null);
    }
  };

  /* Sidecar (Cursor/Claude Code tarzı): ajan bir dosyayı yazınca/düzenleyince
     sağ editör panelini otomatik aç ve YENİ içeriği canlı göster. checkpoint_event
     ile tetiklenir; içerik repodan taze çekilir (commit yeni atılmıştır). */
  const showWrittenFile = useCallback(async (path: string) => {
    const store = useStore.getState();
    const r = store.repo;
    if (!r) return;
    try {
      const activeRepo = store.config.activeRepo || "";
      let content: string;
      if (isGitLabRepo(activeRepo)) {
        content = await fetchGitLabFileContent(r.owner, r.repo, r.branch, path, store.activeGitlab()?.token);
      } else {
        content = await fetchFileContent(r.owner, r.repo, r.branch, path, store.activeGithub()?.token);
      }
      openInEditor({ path, content, language: detectLanguage(path) });
    } catch { /* dosya henüz okunamadıysa sessiz geç */ }
  }, []);

  /* ── Anlamsal (RAG) arama ──────────────────────────────────────────
     İlk kullanımda depo metin dosyalarını (sınırlı sayıda) çekip gömme
     indeksine ekler; indeks repo+branch ile önbelleklenir. Sonra sorguyu
     anlamca en yakın parçalara eşler. */
  const ensureRagIndex = useCallback(async (): Promise<import("@/lib/rag").SemanticIndex | null> => {
    const store = useStore.getState();
    const r = store.repo;
    if (!r || !tree) return null;
    const key = `${r.owner}/${r.repo}@${r.branch}`;
    if (ragIndexRef.current?.key === key && ragIndexRef.current.index.size > 0) {
      return ragIndexRef.current.index;
    }
    const { SemanticIndex, chunkText } = await import("@/lib/rag");
    const index = new SemanticIndex();
    const activeRepo = store.config.activeRepo || "";
    const gitlab = isGitLabRepo(activeRepo);
    const token = gitlab ? store.activeGitlab()?.token : store.activeGithub()?.token;

    const files = getAllFiles(tree)
      .filter((f) => RAG_TEXT_EXT.test(f.path))
      .slice(0, RAG_MAX_FILES);
    setRagProgress({ done: 0, total: files.length });

    /* Eş zamanlılık sınırlı (5) çekme + parçalama. */
    let i = 0;
    let done = 0;
    const worker = async () => {
      while (i < files.length) {
        const f = files[i++];
        try {
          const content = gitlab
            ? await fetchGitLabFileContent(r.owner, r.repo, r.branch, f.path, token)
            : await fetchFileContent(r.owner, r.repo, r.branch, f.path, token);
          if (content && content.length < 100_000) {
            await index.add(chunkText(f.path, content));
          }
        } catch { /* dosya atla */ }
        done++;
        setRagProgress({ done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    ragIndexRef.current = { key, index };
    setRagProgress(null);
    return index;
  }, [tree]);

  const runSemanticSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) { setRagHits([]); return; }
    setRagBusy(true);
    try {
      const index = await ensureRagIndex();
      if (!index || index.size === 0) {
        addToast("Anlamsal indeks kurulamadı (model yüklenemedi)", "error");
        setRagHits([]);
        return;
      }
      const hits = await index.search(q, 8);
      setRagHits(hits);
      if (hits.length === 0) addToast("Eşleşme bulunamadı", "info");
    } finally {
      setRagBusy(false);
    }
  }, [ensureRagIndex, addToast]);

  /* Komut paletinden (Cmd+P) dosya açma isteği → editörde aç. */
  useEffect(() => {
    const handler = async (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path;
      if (!path) return;
      const existing = attachedFiles.find((f) => f.path === path);
      if (existing) {
        openInEditor({ path: existing.path, content: existing.content, language: detectLanguage(path) });
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
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey || useStore.getState().config.providerKeys?.[active.provider] || "",
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
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey || useStore.getState().config.providerKeys?.[active.provider] || "",
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
        ? ALL_AGENTS.find((a) => a.id === messageAgentId) ?? null
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
    /* Bağlam penceresi: çok daha uzun geçmiş gönderilir (sunucu tarafı
       pruneMessages büyük tool çıktılarını ayrıca kırpar). */
    const MAX_CTX = 60;
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
        ? agent.systemPrompt + ((store.toolsEnabled && !!store.repo)
            ? "\n\n[Araçlar açık] Tahmin etme — gerektiğinde read_file/read_files/grep/glob ile ilgili dosyaları incele, git_diff/git_log/git_blame ile değişiklikleri ve geçmişi gör, discover_rules ile proje kurallarını (CLAUDE.md/.rules) oku. ÖNCE keşfet, SONRA yanıtla; iddialarını dosya kanıtına dayandır."
            : "")
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun. KARMAŞIK (çok adımlı) görevlerde ÖNCE update_plan ile KISA bir plan (yapılacaklar listesi) sun, sonra adım adım uygula ve her adım bitince planı güncelle.",
      activeProject?.systemPrompt?.trim() ? `## Proje: ${activeProject.name}\n${activeProject.systemPrompt.trim()}` : "",
      /* Proje bilgi tabanı: yüklenen referans dosyalar (dosya başına kırpılır). */
      activeProject?.files?.length
        ? `## Proje Bilgi Tabanı (referans dosyalar — örnek/bağlam olarak kullan)\n${activeProject.files
            .map((f) => `### ${f.name}\n${f.content.slice(0, 6000)}${f.content.length > 6000 ? "\n…(kırpıldı)" : ""}`)
            .join("\n\n")}`
        : "",
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
      finalSystemPrompt += "\n\n[EFOR: ORTA] Yanıtlamadan önce kısa bir iç değerlendirme yap, ardından net ve eksiksiz yanıt ver.";
    } else if (thinkingMode === "high") {
      finalSystemPrompt +=
        "\n\n[EFOR: YÜKSEK] Bu göreve ciddi efor harca: adım adım analiz et, " +
        "olası yaklaşımları kıyasla, edge case'leri düşün, ardından gerekçeli ve eksiksiz çözümü ver.";
    } else if (thinkingMode === "max") {
      finalSystemPrompt +=
        "\n\n[EFOR: MAX] Mümkün olan en yüksek eforu harca. Problemi birden fazla açıdan incele, " +
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
    let realUsage: { prompt: number; completion: number } | null = null; // sağlayıcı gerçek token
    let thinkingFull = ""; // reasoning delta'ları birikir
    try {
      /* Projeye özel Skills: aktif projede skillIds tanımlıysa global "enabled"
         yerine yalnızca o set kullanılır; aksi halde global aktif skills. */
      const projectSkillIds = activeProject?.skillIds;
      const allEnabledSkills = projectSkillIds && projectSkillIds.length > 0
        ? (store.config.skills ?? []).filter((s) => projectSkillIds.includes(s.id))
        : (store.config.skills ?? []).filter((s) => s.enabled);
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
      const endpoint = swarmModeRef.current && !isContinuation ? "/api/orchestrate" : "/api/chat";
      const callViaServer = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtl.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey || useStore.getState().config.providerKeys?.[active.provider] || "",
          provider: active.provider, systemPrompt: finalSystemPrompt,
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills.map((s) => ({
            title: s.title, content: s.content, tags: s.tags, source: s.source, fileName: s.fileName,
          })),
          tools: toolsEnabled,
          webSearch: searchOnRef.current,
          requireWriteApproval: store.config.requireWriteApproval,
          safeMode: store.config.safeMode,
          toolPermissions: store.config.toolPermissions,
          planApprovalMode: store.config.planApprovalMode,
          planApproved: planApprovedRef.current,
          blockNetworkTools: store.config.blockNetworkTools,
          /* Terminal varsa ajana run_command aracı sunulur (uzak WS veya WebContainer). */
          terminalAvailable: !!(store.config.terminalWsUrl?.trim()) || terminalSupported,
          temperature: activeProjectCfg?.temperature,
          maxTokens: activeProjectCfg?.maxTokens,
          effort: thinkingMode,
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
            /* Ajan Ekibi (Swarm) ilerleme olayı → todo paneli canlı güncelle */
            if (parsed.swarm_event) {
              useStore.getState().setSwarmOnLast(parsed.swarm_event as import("@/lib/types").SwarmState);
              continue;
            }
            /* run_command: ajan terminalde komut çalıştırmak istiyor → terminali
               aç ve komutu gönder. Çıktı craftai:terminal-output ile geri döner. */
            if (parsed.run_command_event) {
              /* Terminali ARKAPLANDA hazırla; komut arkaplanda çalışır, ilerleme
                 sohbetteki "Terminal" todo kutusunda görünür, çıktı AI'ya döner. */
              runInTerminal(String(parsed.run_command_event.command ?? ""));
              continue;
            }
            /* bitiş nedeni: "length" ⇒ token sınırında kesildi → şerit + oto-devam */
            if (parsed.finish_event) {
              const reason = String(parsed.finish_event.reason ?? "");
              if (reason === "length") cutAtLength = true;
              useStore.getState().setFinishReasonOnLast(reason && reason !== "stop" ? reason : undefined);
              continue;
            }
            /* Sağlayıcının bildirdiği GERÇEK token kullanımı → tahmini ezer. */
            if (parsed.usage_event) {
              const p = Number(parsed.usage_event.prompt) || 0;
              const c = Number(parsed.usage_event.completion) || 0;
              if (p || c) realUsage = { prompt: p, completion: c };
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
                /* Sidecar: yazılan dosyayı canlı olarak editörde aç. */
                void showWrittenFile(path);
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
            if (reasoning) { thinkingFull += reasoning; useStore.getState().updateLastThinking(thinkingFull); }
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
        /* Tümünü sekme olarak aç (ilki aktif), birden fazla dosya yazıldıysa da
           hepsi sekme şeridinde görünsün. */
        for (const af of autoFiles) openInEditor(af);
        openInEditor(autoFiles[0]);
      }
      setPendingCommit(autoFiles.length >= 2 ? autoFiles : null);

      /* Otomasyonlar (Claude Code hooks benzeri): afterResponse her yanıttan
         sonra, afterWrite yalnızca ajan dosya yazınca çalışır. Eşleşen komutlar
         sıralı (&&) tek seferde terminale gönderilir. */
      {
        const wroteFiles = autoFiles.length > 0 || turnCheckpoints.length > 0;
        const due = (store.config.automations ?? [])
          .filter((a) => a.enabled && a.command.trim())
          .filter((a) => a.event === "afterResponse" || (a.event === "afterWrite" && wroteFiles))
          .map((a) => a.command.trim());
        if (due.length > 0) runInTerminal(due.join(" && "));
      }

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

      /* Yanıttaki HER önizlenebilir kodu (HTML/CSS/JS, React/JSX/TSX, SVG, mermaid)
         canvas'ta otomatik CANLI önizle. Önizlenemeyen kod varsa mevcut önizleme korunur. */
      const previewArtifact = buildPreview(full);
      if (previewArtifact) useStore.getState().setArtifact(previewArtifact);

      /* Token: sağlayıcı gerçek usage döndürdüyse onu kullan (kesin); yoksa
         karakter-tabanlı tahmine düş. */
      let tokenIn: number, tokenOut: number;
      if (realUsage) {
        tokenIn = realUsage.prompt;
        tokenOut = realUsage.completion;
      } else {
        /* Gerçek tokenizer (gpt-tokenizer, tembel yüklenir) ile doğru say. */
        const { countTokens } = await import("@/lib/tokenizer");
        const inputText = apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join("\n");
        tokenIn = (await countTokens(inputText)) + (await countTokens(coderSystemPrompt));
        tokenOut = await countTokens(full.slice(priorLen));
      }
      useStore.getState().updateLastTokens(tokenIn, tokenOut);
      /* geri-al noktalarını mesaja yaz → persistCurrent ile sohbetle kaydedilir,
         sayfa yenilense bile son turun "Geri Al" imkânı kaybolmaz */
      if (turnCheckpoints.length) useStore.getState().setCheckpointsOnLast(turnCheckpoints);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        /* Kullanıcı durdurdu: hiç içerik gelmediyse boş asistan baloncuğunu kaldır. */
        if (!full) useStore.getState().popLastMessage();
      } else {
        useStore.getState().updateLastContent(`**Hata:** ${friendlyError((err as Error).message)}`);
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
       Sonsuz döngüye karşı en çok 8 ardışık otomatik devam. */
    const depth = opts?.depth ?? 0;
    if (cutAtLength && useStore.getState().config.autoContinue !== false && depth < 8 && !abortCtl.signal.aborted) {
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

  const allFiles = useMemo(() => (tree ? getAllFiles(tree) : []), [tree]);
  const filteredFiles = useMemo(
    () => fuzzyFiles(allFiles, repoSearch),
    [allFiles, repoSearch],
  );
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

        {/* Token + maliyet — her zaman görünür; göndermeden önce yazılan metnin
           ve eklenen dosyaların yaklaşık token tahminini canlı gösterir. */}
        {config.models.length > 0 && (
          <UsageBadge
            chat={current ?? {}}
            pendingTokens={
              estimateTokens(input) + attachedFiles.reduce((a, f) => a + estimateTokens(f.content), 0)
            }
          />
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
          <ThinkingModeToggle />
          {/* Birleşik ⋯ menüsü: Editör · Terminal · Git · PR · Skills · Dışa aktar */}
          <MoreMenu placement="bottom" active={editorOpen || terminalOpen || gitPanelOpen || filesOpen || toolsEnabled || !!config.safeMode || !!artifact}>
            <MoreItem
              icon={<Code2 size={14} />}
              label={editorOpen ? "Editörü kapat" : "Editör (IDE)"}
              active={editorOpen}
              onClick={() => setEditorOpen((v) => !v)}
            />
            <MoreItem
              icon={<Terminal size={14} />}
              label={terminalSupported ? (terminalOpen ? "Terminal'i kapat" : "Terminal") : "Terminal (masaüstü Chrome/Edge)"}
              active={terminalOpen}
              onClick={() => { setTerminalMounted(true); setTerminalOpen((v) => !v); }}
            />
            <MoreItem icon={<GitBranch size={14} />} label="Git & PR (dal, PR/MR, incele)" active={gitPanelOpen} onClick={() => setGitPanelOpen((v) => !v)} />
            <MoreItem icon={<FolderOpen size={14} />} label="Dosyalar (depo)" active={filesOpen} onClick={() => setFilesOpen((v) => !v)} />
            <MoreItem
              icon={<Wrench size={14} />}
              label="Tools (araç kullanımı)"
              active={toolsEnabled}
              onClick={() => {
                const store = useStore.getState();
                if (!store.repo) { addToast("Tool-use için önce bir GitHub deposu bağla", "error"); return; }
                store.setToolsEnabled(!store.toolsEnabled);
              }}
            />
            <MoreItem
              icon={<ShieldCheck size={14} />}
              label="Güvenli Mod (salt-okunur)"
              active={!!config.safeMode}
              onClick={() => useStore.getState().saveConfig({ ...config, safeMode: !config.safeMode })}
            />
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
            <MoreItem icon={<BookOpen size={14} />} label="Kütüphane" onClick={() => { useStore.getState().setLibraryTab("snippets"); useStore.getState().setLibraryOpen(true); }} />
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
                <div className="relative flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                    <input
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      onKeyDown={(e) => { if (semanticMode && e.key === "Enter") runSemanticSearch(repoSearch); }}
                      placeholder={semanticMode ? "Anlamca ara, Enter…" : "Bulanık ara…"}
                      className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                    />
                  </div>
                  <button
                    onClick={() => { setSemanticMode((v) => !v); setRagHits([]); }}
                    title={semanticMode ? "Anlamsal arama açık (kelime aramasına dön)" : "Anlamsal arama (AI gömme)"}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${semanticMode ? "bg-brand/15 text-brand" : "text-muted/50 hover:text-ink hover:bg-bgsoft/60"}`}
                  >
                    <Sparkles size={12} />
                  </button>
                </div>
                {semanticMode && ragProgress && (
                  <div className="mt-1.5 px-0.5">
                    <div className="flex items-center justify-between text-[9px] text-muted/50 mb-0.5">
                      <span>İndeksleniyor…</span>
                      <span className="tabular-nums">{ragProgress.done}/{ragProgress.total}</span>
                    </div>
                    <div className="h-1 rounded-full bg-bgsoft overflow-hidden">
                      <div className="h-full bg-brand transition-all" style={{ width: `${ragProgress.total ? (ragProgress.done / ragProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {!tree && connecting ? (
                /* Profesyonel iskelet: ağaç yüklenirken titreşimli satırlar. */
                <div className="px-2 py-1.5 space-y-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12 + 4}px` }}>
                      <div className="w-3 h-3 rounded shimmer shrink-0" />
                      <div className="h-3 rounded shimmer" style={{ width: `${45 + ((i * 7) % 40)}%` }} />
                    </div>
                  ))}
                </div>
              ) : !tree ? (
                <div className="px-3 py-6 text-center">
                  <FolderGit2 size={22} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-[10px] text-muted/40 leading-relaxed mb-2">
                    {config.activeRepo ? config.activeRepo : "Depo seç veya ekle"}
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
              ) : semanticMode ? (
                <div className="py-1">
                  {ragBusy && !ragProgress ? (
                    <div className="px-3 py-4 text-center text-[10px] text-muted/50 flex items-center justify-center gap-1.5">
                      <RefreshCw size={11} className="animate-spin text-brand" /> Anlamca aranıyor…
                    </div>
                  ) : ragHits.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] text-muted/40 leading-relaxed">
                      <Sparkles size={18} className="mx-auto mb-2 text-muted/20" />
                      Anlamsal arama: ne aradığını <em>doğal dille</em> yaz, Enter&apos;a bas.
                      <br />İlk aramada depo indekslenir (model indirilir).
                    </div>
                  ) : (
                    ragHits.map((h, i) => {
                      const isAttached = attachedPaths.includes(h.path);
                      return (
                        <button
                          key={`${h.path}-${h.line}-${i}`}
                          onClick={() => { const f = getAllFiles(tree).find((x) => x.path === h.path); if (f) attachRepoFile(f); }}
                          className={`w-full flex flex-col gap-0.5 px-3 py-1.5 text-left rounded transition-colors ${isAttached ? "bg-brand/10" : "hover:bg-bgsoft/50"}`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {fetchingFile === h.path ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" /> : <FileIcon name={h.path.split("/").pop() || h.path} size={10} />}
                            <span className="truncate flex-1 text-muted/90">{h.path}</span>
                            <span className="text-[8px] text-muted/40">:{h.line}</span>
                            <span className="text-[8px] font-mono text-brand/60 tabular-nums shrink-0">{(h.score * 100).toFixed(0)}%</span>
                          </div>
                          <div className="text-[9px] text-muted/40 font-mono truncate pl-4">{h.text.trim().slice(0, 80)}</div>
                        </button>
                      );
                    })
                  )}
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
                <FileTreeNode
                  node={tree}
                  onSelect={attachRepoFile}
                  attached={attachedPaths}
                  onContextMenu={(f, e) => setTreeMenu({ x: e.clientX, y: e.clientY, file: f })}
                />
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
                  const isLast = i === messages.length - 1;
                  return (
                    /* cv-msg: ekran dışı eski mesajları sanallaştırır (akıcı
                       kaydırma). Son mesaj akış/paneller için hariç tutulur. */
                    <div key={i} className={isLast ? undefined : "cv-msg"}>
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
                            onOpenInEditor={(f) => openInEditor(f)}
                          />
                        </div>
                      )}
                      {/* Canlı görev paneli — her modda, akış sırasında da görünür. */}
                      {isLastAssistant && m.plan && (
                        <TaskPanel plan={m.plan} streaming={streaming} />
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

          {/* Terminal — bir kez boot olur, ARKAPLANDA mount kalır; kapatınca
              yalnızca gizlenir (unmount olmaz) → ajan komutları hep çalışır. */}
          {terminalMounted && (
            <div className={terminalOpen ? "" : "hidden"}>
              <ErrorBoundary variant="inline" label="Terminal çöktü">
                <RealTerminal onClose={() => setTerminalOpen(false)} />
              </ErrorBoundary>
            </div>
          )}

          {/* Composer */}
          <div
            className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-3xl mx-auto px-5 relative">

              {/* En alta in butonu (kullanıcı yukarı kaydırdıysa) */}
              {showScrollDown && messages.length > 0 && (
                <button
                  onClick={scrollToBottom}
                  title="En alta in"
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-surface border border-line shadow-lg grid place-items-center text-muted hover:text-ink hover:border-brand/40 transition-colors animate-fade-in"
                >
                  <ArrowDown size={16} />
                </button>
              )}

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

              {/* Mention menu — ekli dosyalar + tüm proje ağacı */}
              {mentionOpen && (attachedFiles.length > 0 || allFiles.length > 0) && (
                <MentionMenu
                  query={mentionQuery}
                  items={[
                    ...attachedFiles.map((f) => ({ path: f.path, attached: true })),
                    ...allFiles
                      .filter((f) => !attachedFiles.some((a) => a.path === f.path))
                      .map((f) => ({ path: f.path, attached: false })),
                  ]}
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
                    /* Henüz ekli değilse repo dosyasının içeriğini çekip ekle ki
                       model dosyayı bağlamda görsün. */
                    if (!item.attached) {
                      const repoFile = allFiles.find((f) => f.path === item.path);
                      if (repoFile) void attachRepoFile(repoFile);
                    }
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
                    if (mentionMatch && (attachedFiles.length > 0 || allFiles.length > 0)) {
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
                {/* Daha fazla — mikrofon ile gönder arasında; mesaj-oluşturma eylemleri */}
                <MoreMenu active={searchOn || swarmMode}>
                  <MoreItem icon={<Paperclip size={14} />} label="Dosya ekle" onClick={() => fileRef.current?.click()} />
                  <MoreItem icon={<ImageIcon size={14} />} label="Görsel ekle" onClick={() => imgRef.current?.click()} />
                  <MoreItem icon={<Globe size={14} />} label="Web arama" active={searchOn} onClick={() => setSearchOn(!searchOn)} />
                  <MoreItem icon={<Users size={14} />} label="Ajan Ekibi (Swarm)" active={swarmMode} onClick={() => setSwarmMode((v) => !v)} />
                </MoreMenu>
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

              {/* Alt durum çubuğu */}
              <div className="flex items-center justify-end mt-2 px-0.5">

                <div className="flex items-center gap-1.5 text-[11px] text-muted/50 shrink-0">
                  {config.safeMode && (
                    <span className="flex items-center gap-1 text-amber-400 font-medium" title="Salt-okunur: ajan hiçbir değişiklik yapamaz">
                      <ShieldCheck size={12} /> Güvenli
                    </span>
                  )}
                  {searchOn && <span className="text-brand font-medium">Web</span>}
                  {swarmMode && <span className="flex items-center gap-1 text-brand font-medium" title="Ajan Ekibi: planlayıcı → paralel uzman işçiler → birleştirici"><Users size={12} /> Ekip</span>}
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
          openTabs={openTabs}
          onSelectTab={selectTab}
          onCloseTab={closeTab}
          onEditorDirtyChange={setActiveDirty}
          onCloseEditor={() => {
            if (activeDirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Editör kapatılsın mı?")) return;
            setEditorOpen(false);
            setOpenTabs([]);
            setActiveDirty(false);
          }}
          onAskAI={(_text, context) => {
            useStore.getState().setPendingInput(context);
          }}
          gitOpen={gitPanelOpen}
          onCloseGit={() => setGitPanelOpen(false)}
          onReviewPr={() => setPrModalOpen(true)}
          artifact={artifact}
        />
      </div>

      {/* PR / MR Review Modal */}
      {/* Dosya ağacı sağ-tık menüsü */}
      {treeMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setTreeMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setTreeMenu(null); }}
          />
          <div
            className="fixed z-50 min-w-[180px] bg-surface border border-line rounded-xl shadow-2xl py-1 text-[12px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(treeMenu.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 200),
              top: Math.min(treeMenu.y, (typeof window !== "undefined" ? window.innerHeight : 9999) - 150),
            }}
          >
            <div className="px-3 py-1.5 text-[10px] text-muted/60 truncate border-b border-line/40 mb-1">{treeMenu.file.path}</div>
            <button
              onClick={() => { openTreeFile(treeMenu.file); setTreeMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Code2 size={13} className="text-muted" /> Editörde aç
            </button>
            <button
              onClick={() => { attachRepoFile(treeMenu.file); setTreeMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Paperclip size={13} className="text-muted" />
              {attachedPaths.includes(treeMenu.file.path) ? "Sohbetten çıkar" : "Sohbete ekle"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(treeMenu.file.path)
                  .then(() => addToast("Yol kopyalandı", "success"))
                  .catch(() => { /* yok say */ });
                setTreeMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bgsoft/60 transition-colors"
            >
              <Copy size={13} className="text-muted" /> Yolu kopyala
            </button>
          </div>
        </>
      )}

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
/* Canlı görev paneli — update_plan'in yazdığı [ ]/[~]/[x] listesini ikonlu
   checklist olarak gösterir; akış sırasında gerçek zamanlı güncellenir. */
type TaskStatus = "todo" | "doing" | "done";
function parsePlan(plan: string): { status: TaskStatus; text: string }[] {
  return plan
    .split("\n")
    .map((line) => {
      const m = line.match(/^\s*(?:[-*]\s*)?\[([ ~xX])\]\s*(.*)$/);
      if (!m) return null;
      const mark = m[1].toLowerCase();
      const status: TaskStatus = mark === "x" ? "done" : mark === "~" ? "doing" : "todo";
      return { status, text: m[2].trim() };
    })
    .filter((s): s is { status: TaskStatus; text: string } => s !== null && s.text.length > 0);
}

function TaskPanel({ plan, streaming }: { plan: string; streaming: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const steps = parsePlan(plan);
  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.status === "done").length;
  const allDone = done === steps.length;

  return (
    <div className="ml-11 max-w-2xl mt-2 rounded-xl border border-line/60 bg-bgsoft/40 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bgsoft/60 transition-colors"
      >
        <ListChecks size={13} className={allDone ? "text-green shrink-0" : "text-brand shrink-0"} />
        <span className="font-semibold flex-1 text-left">Görevler</span>
        <span className="font-mono text-muted/70">{done}/{steps.length}</span>
        {streaming && !allDone && <Loader2Icon size={11} className="animate-spin text-brand/70" />}
        <ChevronDown size={13} className={`text-muted/50 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <ul className="px-3 pb-2.5 pt-0.5 space-y-1.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {s.status === "done" ? (
                <CircleCheck size={14} className="text-green shrink-0 mt-px" />
              ) : s.status === "doing" ? (
                <Loader2Icon size={14} className="text-brand shrink-0 mt-px animate-spin" />
              ) : (
                <Circle size={14} className="text-muted/40 shrink-0 mt-px" />
              )}
              <span className={s.status === "done" ? "text-muted/60 line-through" : s.status === "doing" ? "text-ink font-medium" : "text-muted"}>
                {s.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Sağlayıcıların ücretsiz katman limitleri (canlı uç yoksa gösterilen bilgi). */
const FREE_TIER_INFO: Partial<Record<string, string>> = {
  gemini: "Ücretsiz: ~15 istek/dakika, günde 1.500 istek (model bazlı). Her gün 00:00 PT'de sıfırlanır.",
  groq: "Ücretsiz: dakikalık token + istek limiti. Her dakika başında yenilenir.",
  openrouter: "Ücretsiz modeller (:free): günlük istek limiti. Gün başında sıfırlanır. Ücretli kredide canlı bakiye gösterilir.",
  pollinations: "Ücretsiz ve gömülü — sınır pratikte yok.",
  hf: "Ücretsiz katman: saatlik kredi. Saat başı yenilenir.",
  cerebras: "Ücretsiz: günlük token limiti. Gün başında sıfırlanır.",
  mistral: "Ücretsiz katman: aylık token kotası.",
  ollama: "Yerel — sınır yok (kendi donanımın).",
};

interface UsageQuota {
  supported: boolean;
  creditRemaining?: number;
  creditUsed?: number;
  currency?: string;
  limit?: number;
  remaining?: number;
  isFreeTier?: boolean;
  resetText?: string;
  label?: string;
  note?: string;
}

/* Token + maliyet rozeti — tıklanınca canlı kota pop-up'ı açar. */
function UsageBadge({ chat, pendingTokens = 0 }: { chat: { totalInTokens?: number; totalOutTokens?: number }; pendingTokens?: number }) {
  const config = useStore((s) => s.config);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const tokenIn = chat.totalInTokens ?? 0;
  const tokenOut = chat.totalOutTokens ?? 0;
  const total = tokenIn + tokenOut;
  const activeModel = config.models.find((m) => m.id === config.activeModelId);
  const cost = activeModel ? calculateCost(activeModel.model, tokenIn, tokenOut) : null;
  const hasPrice = activeModel ? getModelPrice(activeModel.model) !== null : false;
  const pct = config.maxContext > 0 ? Math.min(100, (tokenIn / config.maxContext) * 100) : 0;
  const warn = pct >= 80;
  const danger = pct >= 95;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.right, top: r.bottom + 6 });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg border mr-1 transition-colors hover:border-brand/40 ${
          danger ? "border-red/40 bg-red/5 text-red"
          : warn ? "border-amber-400/40 bg-amber-400/5 text-amber-400"
          : "border-line/40 text-muted/70"
        }`}
        title={pendingTokens > 0
          ? `Bu sohbet: ${total.toLocaleString()} token · Göndereceğin: ~${pendingTokens.toLocaleString()} token. Detay için tıkla.`
          : "Token & kota detayı için tıkla"}
      >
        <span className="relative w-3 h-3" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-current opacity-15" />
          <span className="absolute inset-0 rounded-full bg-current" style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }} />
        </span>
        <span>{total.toLocaleString()} tok</span>
        {pendingTokens > 0 && (
          <span className="text-brand/80" title="Göndermeden önce tahmini ek token">+~{pendingTokens.toLocaleString()}</span>
        )}
        {cost !== null && hasPrice && (
          <>
            <span className="opacity-40">·</span>
            <span className={danger || warn ? "" : "text-brand/80"}>{formatCost(cost)}</span>
          </>
        )}
      </button>
      {open && pos && <UsageModal chat={chat} pos={pos} onClose={() => setOpen(false)} />}
    </>
  );
}

function UsageModal({ chat, pos, onClose }: { chat: { totalInTokens?: number; totalOutTokens?: number }; pos: { left: number; top: number }; onClose: () => void }) {
  const config = useStore((s) => s.config);
  const activeModel = config.models.find((m) => m.id === config.activeModelId);
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [loading, setLoading] = useState(!!activeModel);

  const tokenIn = chat.totalInTokens ?? 0;
  const tokenOut = chat.totalOutTokens ?? 0;
  const total = tokenIn + tokenOut;
  const pct = config.maxContext > 0 ? Math.min(100, (tokenIn / config.maxContext) * 100) : 0;
  const cost = activeModel ? calculateCost(activeModel.model, tokenIn, tokenOut) : null;
  const price = activeModel ? getModelPrice(activeModel.model) : null;
  const provider = activeModel?.provider ?? "";
  const freeInfo = FREE_TIER_INFO[provider];

  useEffect(() => {
    if (!activeModel) return;
    let alive = true;
    fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: activeModel.provider, baseUrl: activeModel.baseUrl, apiKey: activeModel.apiKey }),
    })
      .then((r) => r.json())
      .then((d: UsageQuota) => { if (alive) setQuota(d); })
      .catch(() => { if (alive) setQuota({ supported: false }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeModel]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div
        style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translateX(-100%)" }}
        className="z-[71] w-[300px] max-h-[72vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 animate-modal-content"
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line/60 sticky top-0 bg-surface">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-brand" />
            <h3 className="font-bold text-xs">Kullanım & Kota</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 text-sm">
          {/* Aktif model */}
          <div className="flex items-center justify-between">
            <span className="text-muted text-xs">Aktif model</span>
            <span className="font-mono text-xs font-semibold truncate max-w-[180px]">{activeModel?.label || activeModel?.model || "—"}</span>
          </div>

          {/* Bu oturum */}
          <div className="rounded-xl border border-line/60 bg-bgsoft/40 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50">Bu sohbet</div>
            <div className="flex justify-between text-xs"><span className="text-muted">Girdi</span><span className="font-mono">{tokenIn.toLocaleString()} tok</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted">Çıktı</span><span className="font-mono">{tokenOut.toLocaleString()} tok</span></div>
            <div className="flex justify-between text-xs font-semibold border-t border-line/40 pt-2"><span>Toplam</span><span className="font-mono">{total.toLocaleString()} tok</span></div>
            {cost !== null && price && (
              <div className="flex justify-between text-xs"><span className="text-muted">Tahmini maliyet</span><span className="font-mono text-brand">{formatCost(cost)}</span></div>
            )}
            {/* Bağlam doluluğu */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-muted/60 mb-1">
                <span>Bağlam penceresi</span><span className="font-mono">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bgsoft overflow-hidden">
                <div className={`h-full transition-all ${pct >= 95 ? "bg-red" : pct >= 80 ? "bg-amber-400" : "bg-brand"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Hesap durumu (canlı kota) */}
          <div className="rounded-xl border border-line/60 bg-bgsoft/40 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50">Hesap durumu</div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted/60 py-1">
                <Loader2Icon size={13} className="animate-spin" /> Sağlayıcıdan çekiliyor…
              </div>
            ) : quota?.supported ? (
              <>
                {quota.creditRemaining !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Kalan kredi</span>
                    <span className="font-mono font-semibold text-green">{quota.currency === "USD" ? "$" : ""}{quota.creditRemaining.toFixed(4)} {quota.currency !== "USD" ? quota.currency : ""}</span>
                  </div>
                )}
                {quota.creditUsed !== undefined && (
                  <div className="flex justify-between text-xs"><span className="text-muted">Harcanan</span><span className="font-mono">${quota.creditUsed.toFixed(4)}</span></div>
                )}
                {quota.isFreeTier !== undefined && (
                  <div className="flex justify-between text-xs"><span className="text-muted">Katman</span><span className="font-mono">{quota.isFreeTier ? "Ücretsiz" : "Ücretli"}</span></div>
                )}
                {quota.note && <p className="text-[11px] text-muted/60 leading-relaxed pt-1">{quota.note}</p>}
              </>
            ) : (
              <p className="text-[11px] text-muted/60 leading-relaxed">
                {freeInfo ?? "Bu sağlayıcı canlı bakiye/kota uçları sunmuyor."}
                {quota?.note && <span className="block mt-1 text-muted/40">{quota.note}</span>}
              </p>
            )}
          </div>

          {/* Fiyat tablosu */}
          {price && (
            <div className="flex items-center justify-between text-[11px] text-muted/60">
              <span>Fiyat (1M token)</span>
              <span className="font-mono">girdi ${price.inputPerMTok} · çıktı ${price.outputPerMTok}</span>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}


