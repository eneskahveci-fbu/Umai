"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { decryptField, isEncrypted } from "@/lib/secureKeys";
import { buildFallbackChain } from "@/lib/fallback";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  ChevronDown,
  GitBranch,
  ChevronRight,
  Code2,
  Copy,
  File,
  FolderGit2,
  FolderOpen,
  Folder,
  GraduationCap,
  Bot,
  Circle,
  CircleCheck,
  GitPullRequest,
  Globe,
  MoreHorizontal,
  Image as ImageIcon,
  Loader2 as Loader2Icon,
  MessageSquare,
  PanelLeft,
  Paperclip,
  Check,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Sparkles,
  Wand2,
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
import { bridgeListFiles, bridgeReadFile, buildTreeFromPaths } from "@/lib/bridgeFs";
import { extractAllFileFences } from "@/lib/parsers";
import { fuzzyFiles } from "@/lib/fuzzy";
import { buildPreview } from "@/lib/preview";
import { splitReasoning } from "@/lib/reasoning";

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
import { isAdminEmail } from "@/lib/admin";
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
import { detectSensitive } from "@/lib/pii";
import { friendlyError } from "@/lib/friendlyError";
import { autoEffort, autoSwarm, decidePilot, type PilotDecision } from "@/lib/autoPilot";
import { pickDraftModels, buildBoostInstruction, generateDrafts } from "@/lib/boost";
import { importSkillFromUrl } from "@/lib/skillImport";
import { retrieve } from "@/lib/retrieval";
import { PLATFORM_KNOWLEDGE } from "@/lib/platform-knowledge";
import { CRAFT_OPERATING_MANUAL } from "@/lib/constants";
import { addPendingAction, removePendingAction, isCommandAllowed, matchDangerousCommand, DEFAULT_COMMAND_ALLOWLIST, type PendingAction } from "@/lib/agentActions";

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
function MoreMenu({ active, children, placement = "top", icon, title = "Daha fazla" }: { active?: boolean; children: React.ReactNode; placement?: "top" | "bottom"; icon?: React.ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  /* Mobilde (sm altı) menü, dropdown yerine alttan açılan tam genişlik SHEET olur
     (iOS hissi: backdrop + tutamaç + safe-area). Masaüstünde konumlu dropdown. */
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      setSheet(window.matchMedia("(max-width: 639px)").matches);
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
        title={title}
        className={`flex items-center gap-1.5 text-[12px] px-2 py-2 sm:py-1.5 rounded-lg transition-colors active:scale-95 ${
          open || active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft active:bg-bgsoft"
        }`}
      >
        {icon ?? <MoreHorizontal size={13} />}
      </button>
      {open && sheet && createPortal(
        <>
          <div className="fixed inset-0 z-[79] bg-black/40 animate-modal-bg" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 z-[80] bg-surface border-t border-line rounded-t-2xl shadow-2xl shadow-black/40 p-2 pt-1.5 flex flex-col gap-0.5 max-h-[75dvh] overflow-y-auto animate-modal-bg"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-line/80 mb-1.5 shrink-0" />
            {children}
          </div>
        </>,
        document.body,
      )}
      {open && !sheet && pos && createPortal(
        <div
          ref={menuRef}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, transform: "translateX(-100%)" }}
          className="min-w-[230px] max-h-[70vh] overflow-y-auto bg-surface border border-line rounded-xl shadow-2xl shadow-black/40 p-1 z-[80] flex flex-col gap-0.5 animate-modal-bg"
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MoreItem({ onClick, icon, label, desc, active }: { onClick: () => void; icon: React.ReactNode; label: string; desc?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 text-[12px] px-2.5 py-2 rounded-lg text-left transition-colors ${
        active ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {desc && <span className="block text-[10px] text-muted/50 truncate">{desc}</span>}
      </span>
    </button>
  );
}

/* Hızlı model değiştirici — header'daki model adına tıkla → listeden anında geç
   (Ayarlar'a girmeden). Copilot'un model picker'ı gibi. */
function ModelSwitcher() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const active = config.models.find((m) => m.id === config.activeModelId);
  if (config.models.length === 0) {
    return (
      <button onClick={() => setSettingsOpen(true)} className="text-xs px-2 py-1 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors">
        + Model
      </button>
    );
  }
  return (
    <MoreMenu
      placement="bottom"
      icon={
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
          <span className="truncate max-w-[140px] font-medium">{active?.label || active?.model || "Model seç"}</span>
        </span>
      }
    >
      <div className="px-2.5 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted/50" onClick={(e) => e.stopPropagation()}>
        Aktif model
      </div>
      {config.models.map((m) => (
        <MoreItem
          key={m.id}
          icon={m.id === config.activeModelId ? <Check size={13} className="text-brand" /> : <span className="w-[13px] grid place-items-center"><span className="w-1.5 h-1.5 rounded-full bg-muted/40" /></span>}
          label={m.label || m.model}
          desc={m.provider}
          active={m.id === config.activeModelId}
          onClick={() => saveConfig({ ...config, activeModelId: m.id })}
        />
      ))}
      <div className="h-px bg-line/60 my-0.5" />
      <MoreItem icon={<Wrench size={13} />} label="Model ekle / yönet…" onClick={() => setSettingsOpen(true)} />
    </MoreMenu>
  );
}

/* Mod geçişi — kompakt çip (Tools/Güvenli/Öğrenme/Kalite/Ekip tek satırda). */
function ModeChip({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
        active ? "border-brand/40 bg-brand/12 text-brand" : "border-line/60 text-muted hover:text-ink hover:border-brand/30"
      }`}
    >
      {icon}{label}
    </button>
  );
}

const THINKING_LEVELS = [
  { key: "auto",   label: "Oto",    short: "Oto" },
  { key: "low",    label: "Düşük",  short: "Düşük" },
  { key: "medium", label: "Orta",   short: "Orta" },
  { key: "high",   label: "Yüksek", short: "Yüksek" },
  { key: "max",    label: "Max",    short: "Max" },
] as const;


/* ⋯ menüsü içinde kompakt düşünme-eforu seçici. Varsayılan "Oto": efor göreve
   göre otomatik seçilir; kullanıcı isterse buradan elle geçersiz kılar. Menüyü
   kapatmamak için tıklamalar stopPropagation ile durdurulur. */
function EffortMenuControl() {
  const thinkingMode = useStore((s) => s.thinkingMode);
  const setThinkingMode = useStore((s) => s.setThinkingMode);
  return (
    <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted/50 pb-1.5">
        <Brain size={11} /> Düşünme eforu
      </div>
      <div className="flex gap-1">
        {THINKING_LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setThinkingMode(l.key)}
            title={l.label}
            className={`flex-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              thinkingMode === l.key
                ? "bg-brand/15 text-brand"
                : "text-muted hover:text-ink hover:bg-bgsoft"
            }`}
          >
            {l.short}
          </button>
        ))}
      </div>
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
/* API anahtarını isteğin TAM ANINDA çöz: rehydrate yarışı ya da AES anahtar
   uyuşmazlığı olsa bile sağlayıcıya ASLA 'enc:1:…' şifreli blob gitmesin
   (kredili anahtarda bile 401 sorununu önler). Çözülemezse boş döndür + bir kez uyar. */
let warnedDecrypt = false;
async function usableApiKey(model: { apiKey?: string; provider: string }): Promise<string> {
  const cfg = useStore.getState().config;
  let k = model.apiKey || (cfg.providerKeys as Record<string, string> | undefined)?.[model.provider] || "";
  if (k) {
    k = await decryptField(k);
    if (isEncrypted(k)) {
      k = "";
      if (!warnedDecrypt) {
        warnedDecrypt = true;
        useStore.getState().addToast("Kayıtlı API anahtarı çözülemedi (tarayıcı verisi değişmiş olabilir). Ayarlar → Modeller'den anahtarı tekrar gir.", "error");
      }
    } else {
      warnedDecrypt = false;
    }
  }
  return k;
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

/* ── ask_user anket kartı ─────────────────────────────────────────────────────
   Ajan kodlamadan önce tıklanabilir soru(lar) sorduğunda gösterilir. Her soru
   için seçenek butonları + "Diğer" serbest metin; tüm sorular yanıtlanınca
   "Yanıtla & Devam Et" etkinleşir → cevaplar formatlanıp ajana geri yollanır. */
interface SurveyOption { label: string; description?: string; }
interface SurveyQuestion { header: string; question: string; options: SurveyOption[]; }

function SurveyCard({
  questions,
  onSubmit,
}: {
  questions: SurveyQuestion[];
  onSubmit: (answers: string[], questions: SurveyQuestion[]) => void;
}) {
  const [selected, setSelected] = useState<(string | null)[]>(() => questions.map(() => null));
  const [other, setOther] = useState<string[]>(() => questions.map(() => ""));

  const pick = (qi: number, label: string) =>
    setSelected((prev) => prev.map((v, i) => (i === qi ? (v === label ? null : label) : v)));

  const ready = selected.every((v, i) => v !== null || other[i].trim().length > 0);

  const submit = () => {
    if (!ready) return;
    onSubmit(selected.map((v, i) => v ?? other[i].trim()), questions);
  };

  return (
    <div className="ml-11 max-w-2xl mt-3 rounded-xl border border-brand/30 bg-brand/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brand/20 text-xs font-semibold text-brand">
        <MessageSquare size={13} className="shrink-0" />
        <span>Devam etmeden önce birkaç soru — tıkla veya yaz</span>
      </div>
      <div className="divide-y divide-line/30">
        {questions.map((q, qi) => (
          <div key={qi} className="px-3 py-3">
            <p className="text-xs font-semibold text-ink mb-2">{q.question}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {q.options.map((opt) => (
                <button
                  key={opt.label}
                  title={opt.description}
                  onClick={() => pick(qi, opt.label)}
                  className={[
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors text-left",
                    selected[qi] === opt.label
                      ? "bg-brand text-white border-brand"
                      : "border-line bg-bgsoft text-muted hover:border-brand/50 hover:text-ink",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Diğer…"
              value={other[qi]}
              onChange={(e) => {
                const v = e.target.value;
                setOther((prev) => prev.map((x, i) => (i === qi ? v : x)));
                if (v) setSelected((prev) => prev.map((x, i) => (i === qi ? null : x)));
              }}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-line bg-bg text-ink placeholder:text-muted focus:outline-none focus:border-brand/60"
            />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-brand/20 flex justify-end">
        <button
          onClick={submit}
          disabled={!ready}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white disabled:opacity-40 hover:bg-branddim transition-colors"
        >
          Yanıtla &amp; Devam Et
        </button>
      </div>
    </div>
  );
}

export function CoderView() {
  const config = useStore((s) => s.config);
  const isAdmin = isAdminEmail(useStore((s) => s.userEmail));
  const repo = useStore((s) => s.repo);
  const tree = useStore((s) => s.tree);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const pendingInput = useStore((s) => s.pendingInput);

  const toolsEnabledStore = useStore((s) => s.toolsEnabled);
  const artifact = useStore((s) => s.artifact);
  const setRepo = useStore((s) => s.setRepo);
  const setTree = useStore((s) => s.setTree);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const addToast = useStore((s) => s.addToast);

  /* Yerel Mod aktifse github/gitlab repo olmadan da araçlar açılır (gerçek FS+shell). */
  const localActive = !!(config.localMode && config.localBridgeUrl?.trim());
  const toolsEnabled = toolsEnabledStore && (!!repo || localActive);

  const [filesOpen, setFilesOpen] = useState(false);
  /* Sunucu (Hibrit köprü) workspace gezgini — ajanların çalıştığı gerçek dizin. */
  const [wsOpen, setWsOpen] = useState(false);
  const [wsTree, setWsTree] = useState<TreeNode | null>(null);
  const [wsPaths, setWsPaths] = useState<string[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsSearch, setWsSearch] = useState("");
  const [wsFetching, setWsFetching] = useState<string | null>(null);
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


  /* Taslak koruması: yazılan mesaj yenileme/kapanmada kaybolmaz. */
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("craftai_draft") ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (input) localStorage.setItem("craftai_draft", input);
        else localStorage.removeItem("craftai_draft");
      } catch { /* yok say */ }
    }, 400);
    return () => clearTimeout(t);
  }, [input]);
  const [improvingPrompt, setImprovingPrompt] = useState(false);

  /* Prompt geliştirici — composer'daki taslağı ücretsiz LLM ile daha net/etkili
     bir isteme dönüştürür (akışı doğrudan input'a yazar). ⋯ → Modlar'dan tetiklenir. */
  const improvePrompt = async () => {
    const base = input.trim();
    if (!base || improvingPrompt) return;
    setImprovingPrompt(true);
    try {
      const store = useStore.getState();
      const active = store.activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const sys = "Sen bir prompt mühendisisin. Kullanıcının taslak istemini; amacını koruyarak daha NET, eksiksiz ve etkili bir isteme dönüştür. Gerekli bağlamı, beklenen çıktı biçimini ve kısıtları ekle. SADECE geliştirilmiş istemi döndür — açıklama, tırnak veya etiket yazma. Kullanıcının diliyle aynı dilde yaz.";
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: base }],
          baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
          systemPrompt: sys, fallbacks: buildFallbackChain(store.config.models, store.config.activeModelId),
          tools: false, webSearch: false, temperature: 0.7,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = ""; let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const ln of lines) {
          const t = ln.trim();
          if (!t.startsWith("data:")) continue;
          const p = t.slice(5).trim();
          if (!p || p === "[DONE]") continue;
          try {
            const j = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] };
            const d = j.choices?.[0]?.delta?.content ?? "";
            if (d) { full += d; setInput(full); }
          } catch { /* yoksay */ }
        }
      }
      if (!full.trim()) addToast("İstem geliştirilemedi — tekrar dene.", "error");
    } catch (e) {
      addToast(`Geliştirme hatası: ${e instanceof Error ? e.message : "bilinmeyen"}`, "error");
    } finally { setImprovingPrompt(false); }
  };
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  /* Web araması artık MANUEL toggle DEĞİL — Otomatik Pilot (pilot.web) karar
     verir. Döviz/güncel bilgi sorularında kendiliğinden çalışır (autoWeb). */
  /* Çoklu-ajan ("Ajan Ekibi" / Swarm) modu: planlayıcı → paralel uzman işçiler
     → birleştirici (/api/orchestrate). Tek mesajda bir ajan ekibi çalışır. */
  const [swarmMode, setSwarmMode] = useState(false);
  /* Derin Araştırma modu: çok-kaynaklı web araması → atıflı rapor (/api/research). */
  const [researchMode, setResearchMode] = useState(false);
  /* Son gönderimin Otomatik Pilot kararı — ✦ Oto rozeti tooltip'i. */
  const [lastPilot, setLastPilot] = useState<PilotDecision | null>(null);
  /* ⋯ menüsü sekme durumu: Çalışma Alanı · Modlar · Araçlar. */
  const [moreTab, setMoreTab] = useState<"workspace" | "modes" | "tools">("workspace");
  const swarmModeRef = useRef(false);
  useEffect(() => { swarmModeRef.current = swarmMode; }, [swarmMode]);
  const researchModeRef = useRef(false);
  useEffect(() => { researchModeRef.current = researchMode; }, [researchMode]);
  /* Plan onayı: bir sonraki istekte plan-modu kapısını geçici aşar. */
  const planApprovedRef = useRef(false);
  /* afterEdit kancası geri-besleme döngü sayacı (her kullanıcı mesajında sıfırlanır,
     turda en çok 3 tur lint→düzelt → sonsuz döngü engellenir). */
  const hookRunsRef = useRef(0);
  /* Otonom Doğrula-Düzelt: tur sayacı (her kullanıcı mesajında sıfırlanır, en çok
     5 tur → sonsuz döngü engellenir) + tespit edilen doğrulama komutu önbelleği. */
  const verifyRunsRef = useRef(0);
  const verifyCmdRef = useRef<string | null>(null);
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
  /* Otomatik bağlam sıkıştırma önbelleği: aynı eşik için tekrar tekrar
     özetlemeyi önler (key = chatId:eskiMesajSayısı). */
  const compactCacheRef = useRef<{ key: string; summary: string } | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [pendingCommit, setPendingCommit] = useState<EditorFile[] | null>(null);
  /* Ajanın bu turda yazdığı dosyaların ESKİ içeriği — "Geri al" için. */
  const [checkpoints, setCheckpoints] = useState<{ path: string; previous: string | null }[]>([]);
  const [undoing, setUndoing] = useState(false);
  /* Ajanın önerdiği YIKICI işlemler (sil/yeniden adlandır) — onay bekler. */
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  /* ask_user anketi: ajan soru sorduğunda gösterilir; cevaplanınca temizlenir. */
  const [pendingSurvey, setPendingSurvey] = useState<SurveyQuestion[] | null>(null);
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
  /* Composer auto-grow: içerik değiştikçe yükseklik içeriğe uyar (≤240px);
     gönderimde input boşalınca tek satıra döner. */
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 240)}px`;
  }, [input]);
  const endRef = useRef<HTMLDivElement>(null);
  /* Sayfa gizlenirken (uygulama/sekme değişimi) akan kısmi yanıtı kalıcılaştır —
     tarayıcı sekmeyi dondurup yeniden yüklerse bile o ana kadarki yanıt durur. */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && useStore.getState().streaming) void useStore.getState().persistCurrent();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  /* Sekme başlığında canlı durum: yanıt yazılırken ● göstergesi (Claude gibi). */
  useEffect(() => {
    if (!streaming) return;
    const prev = document.title;
    document.title = "● Yanıt yazılıyor… — Craft";
    return () => { document.title = prev; };
  }, [streaming]);
  /* Escape → akışı durdur (Claude davranışı; menüler açıkken onlara öncelik). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().streaming && !slashOpen && !mentionOpen) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
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

  /* Hook olayını tetikle (preToolUse/postToolUse/onStop): o olaya bağlı etkin
     otomasyon komutlarını sıralı (&&) terminale gönderir. Opt-in olduğu için
     yalnızca kullanıcı tanımlarsa çalışır. */
  const fireHooks = (event: "preToolUse" | "postToolUse" | "onStop") => {
    const due = (useStore.getState().config.automations ?? [])
      .filter((a) => a.enabled && a.command.trim() && a.event === event)
      .map((a) => a.command.trim());
    if (due.length > 0) runInTerminal(due.join(" && "));
  };

  /* Bir REPO bağlanınca terminali HER ZAMAN ARKAPLANDA boot et (gizli) → ajan
     komutları hazır olur; repo yokken boşa kaynak harcanmaz. Ön plana ASLA
     kendiliğinden açılmaz; kullanıcı isterse butonla açar. Komut çıktıları
     sohbette "Terminal" todo kutusunda görünür. Bir kez mount olunca kapanmaz. */
  useEffect(() => {
    const useWs = !!config.terminalWsUrl?.trim();
    /* Terminal HER ZAMAN arka planda mount olur (WS URL'i varsa repo gerekmez) →
       hep bağlı/hazır, ekranı KAPLAMAZ. Ön plana KENDİLİĞİNDEN açılmaz; kullanıcı
       üstteki terminal ikonundan açıp bakar. Bir kez mount olunca kapanmaz. */
    if (useWs) { const id = setTimeout(() => setTerminalMounted(true), 0); return () => clearTimeout(id); }
    if (!repo) return; // WebContainer (yerel sanal) yalnızca repo bağlıyken
    let alive = true;
    import("@/lib/webcontainer").then(({ isSupported }) => { if (alive && isSupported()) setTerminalMounted(true); });
    return () => { alive = false; };
  }, [repo, config.terminalWsUrl]);

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
      /* Arka plan görevi bitti → kullanıcıya bildir (uzun komutlar non-blocking
         çalışır; ajan placeholder ile devam etmiş, çıktı şimdi geldi). */
      addToast(`Komut tamamlandı: ${command.length > 40 ? command.slice(0, 40) + "…" : command}`, "info");
      /* AI'ya bağlam olarak besle — bu kullanıcı mesajı sohbette GİZLENİR
         (MessageBubble "**Terminal çıktısı**" ile başlayanları render etmez);
         çıktı zaten todo kutusunda görünür. */
      const msg = `**Terminal çıktısı** (\`${command}\`):\n\`\`\`\n${output}\n\`\`\``;
      useStore.getState().pushMessage({ role: "user", content: msg });
      /* callApi is a stable useCallback defined below; it's only invoked here
         from an event handler that fires after mount, so the forward ref is safe. */
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

  /* ── Sunucu (Hibrit köprü) workspace gezgini ──────────────────────────
     Ajanların çalıştığı gerçek dizini (ör. /opt/craft-bridge/workspace) köprünün
     /fs/list ucundan listeler; dosyaya tıklanınca /fs/read ile okuyup editörde
     açar. Repo mantığından tamamen bağımsız — yalnız localMode'da görünür. */
  const loadWorkspace = async () => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    const token = cfg.localBridgeToken || "";
    if (!url) { addToast("Önce Ayarlar → Hibrit Sunucu adresini gir", "info"); return; }
    setWsLoading(true);
    try {
      const paths = await bridgeListFiles(url, token);
      setWsPaths(paths);
      setWsTree(buildTreeFromPaths(paths));
      if (paths.length === 0) addToast("Workspace boş", "info");
    } catch (e) {
      addToast(`Workspace okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setWsLoading(false);
    }
  };

  const openWorkspaceFile = async (file: TreeFile) => {
    const cfg = useStore.getState().config;
    const url = cfg.localBridgeUrl?.trim();
    const token = cfg.localBridgeToken || "";
    if (!url) return;
    setWsFetching(file.path);
    try {
      const content = await bridgeReadFile(url, token, file.path);
      openInEditor({ path: file.path, content, language: detectLanguage(file.path) });
    } catch (e) {
      addToast(`Dosya okunamadı: ${(e as Error).message}`, "error");
    } finally {
      setWsFetching(null);
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
    /* PDF: istemcide metni çıkar, metin olarak ekle (görsel akışıyla aynı mantık). */
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      if (f.size > 20_000_000) { addToast("PDF 20MB'den büyük.", "error"); return; }
      addToast(`${f.name} okunuyor…`, "info");
      void (async () => {
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const text = await extractPdfText(f);
          setAttachedFiles((prev) => [...prev, { path: f.name, content: text }]);
          addToast(`${f.name} eklendi (metin çıkarıldı).`, "success");
        } catch (e) {
          addToast(`PDF okunamadı: ${(e as Error).message}`, "error");
        }
      })();
      return;
    }
    /* .ipynb → hücre-bazlı okunur biçim (markdown + kod + çıktı). */
    if (f.name.toLowerCase().endsWith(".ipynb")) {
      if (f.size > 2_000_000) { addToast("Notebook 2MB'den büyük.", "error"); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const { ipynbToReadable } = await import("@/lib/notebook");
        setAttachedFiles((prev) => [...prev, { path: f.name, content: ipynbToReadable(reader.result as string) }]);
      };
      reader.readAsText(f);
      return;
    }
    if (f.size > 512_000) { addToast("Dosya 512KB'den büyük.", "error"); return; }
    /* Office dosyaları (zip-tabanlı) düz metin olarak okunamaz → net yönlendirme. */
    if (/\.(docx?|pptx?|xlsx?)$/i.test(f.name)) {
      addToast("Word/PowerPoint/Excel doğrudan okunamıyor — PDF'e çevirip sürükle.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFiles((prev) => [...prev, { path: f.name, content: reader.result as string }]);
    };
    reader.readAsText(f);
  };

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
          baseUrl: active.baseUrl, model: active.model, apiKey: await usableApiKey(active),
        }),
      });
      const { facts } = await res.json();
      if (Array.isArray(facts) && facts.length) {
        store.addAutoMemoryFacts(facts.filter((f: unknown): f is string => typeof f === "string"));
      }
    } catch { /* yoksay */ }
  }, []);

  /* Tek bir kanca komutunu çalıştırıp çıktısını döndür (yalnız Yerel Mod köprüsü
     çıktıyı doğrudan yakalayabilir). Köprü yoksa null. */
  const runHookCommand = useCallback(async (command: string): Promise<string | null> => {
    const cfg = useStore.getState().config;
    if (cfg.localMode && cfg.localBridgeUrl?.trim()) {
      try {
        const r = await fetch(`${cfg.localBridgeUrl.replace(/\/$/, "")}/exec`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.localBridgeToken || ""}` },
          body: JSON.stringify({ command }),
        });
        const d = await r.json();
        return typeof d.error === "string" ? `Hata: ${d.error}` : String(d.output ?? "").slice(0, 8000);
      } catch (e) {
        return `Yerel köprüye ulaşılamadı: ${(e as Error).message}`;
      }
    }
    return null;
  }, []);

  /* Olay kancalarını çalıştır. `edited` = bu tur dosya düzenlendi mi.
     - afterEdit: düzenleme olduysa komutu çalıştır, çıktıyı ajana GERİ BESLE
       (kendi kendine lint/test düzeltsin). En çok 3 tur (hookRunsRef) → döngü yok.
     - onFinish: ajan tamamen durunca yalnız bildir (geri besleme yok). */
  const runHooks = useCallback(async (edited: boolean, phase: "finish" | "error" = "finish") => {
    const hooks = (useStore.getState().config.hooks ?? []).filter((h) => h.enabled);
    if (!hooks.length) return;
    /* onError — ajan/komut hata verince yalnız bildir (geri besleme yok; köprü ile). */
    if (phase === "error") {
      const errHooks = hooks.filter((h) => h.event === "onError");
      const cfg = useStore.getState().config;
      if (errHooks.length && cfg.localMode && cfg.localBridgeUrl?.trim()) {
        for (const h of errHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          await runHookCommand(h.command);
        }
      }
      return;
    }
    /* afterEdit — geri-beslemeli oto-düzelt */
    if (edited && hookRunsRef.current < 3) {
      const editHooks = hooks.filter((h) => h.event === "afterEdit");
      if (editHooks.length) {
        hookRunsRef.current += 1;
        let fedBack = false;
        for (const h of editHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          const out = await runHookCommand(h.command);
          if (out !== null) {
            /* Yerel Mod: çıktıyı doğrudan ajana besle (terminal-output dinleyicisi
               yeni bir callApi başlatır → ajan sonucu görür, hatayı düzeltir). */
            window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command: h.command, output: out || "(çıktı yok)" } }));
          } else {
            /* Köprü yok: komutu terminalde çalıştır; terminal çıktıyı geri besler. */
            setTerminalOpen(true);
            window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: h.command } }));
          }
          fedBack = true;
        }
        if (fedBack) return; // geri-besleme yeni turu tetikler → onFinish'i bu turda atla
      }
    }
    /* onFinish — yalnız bildir (geri besleme yok; sadece köprü ile çalışır) */
    const finishHooks = hooks.filter((h) => h.event === "onFinish");
    if (finishHooks.length) {
      const cfg = useStore.getState().config;
      if (cfg.localMode && cfg.localBridgeUrl?.trim()) {
        for (const h of finishHooks) {
          addToast(`🪝 ${h.label || h.command}`, "info");
          const out = await runHookCommand(h.command);
          if (out !== null) addToast(`🪝 ${h.label || h.command} ✓`, "success");
        }
      }
    }
  }, [addToast, runHookCommand]);

  /* Otonom doğrulama komutunu tespit et (repo package.json'ından, bir kez önbelleğe
     alınır). Öncelik: check > lint (+typecheck/tsc). Bulunamazsa makul varsayılan. */
  const detectVerifyCommand = useCallback(async (): Promise<string> => {
    if (verifyCmdRef.current !== null) return verifyCmdRef.current;
    let cmd = "npm run lint";
    try {
      const store = useStore.getState();
      const r = store.repo;
      if (r) {
        const activeRepo = store.config.activeRepo || "";
        const pkgRaw = isGitLabRepo(activeRepo)
          ? await fetchGitLabFileContent(r.owner, r.repo, r.branch, "package.json", store.activeGitlab()?.token)
          : await fetchFileContent(r.owner, r.repo, r.branch, "package.json", store.activeGithub()?.token);
        const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        const hasTs = !!(pkg.devDependencies?.typescript || pkg.dependencies?.typescript || scripts.typecheck);
        const parts: string[] = [];
        if (scripts.check) parts.push("npm run check");
        else {
          if (scripts.lint) parts.push("npm run lint");
          if (scripts.typecheck) parts.push("npm run typecheck");
          else if (hasTs) parts.push("npx tsc --noEmit");
        }
        if (parts.length) cmd = parts.join(" && ");
      }
    } catch { /* repo/paket okunamadı → varsayılan komut */ }
    verifyCmdRef.current = cmd;
    return cmd;
  }, []);

  /* Otonom Doğrula-Düzelt: ajan bir turda dosya düzenlediyse, arka plandaki terminalde
     doğrulama komutunu çalıştırır. Çıktı craftai:terminal-output ile ajana OTOMATİK
     döner → hata varsa düzeltir (sonraki tur tekrar doğrulanır), temizse onaylar.
     En çok 5 tur (verifyRunsRef) → döngü güvenliği. WS terminal yoksa sessizce atlar. */
  const runAutoVerify = useCallback(async (edited: boolean) => {
    const cfg = useStore.getState().config;
    if (!edited || cfg.autoVerify === false) return;
    if (!cfg.terminalWsUrl?.trim()) return;
    if (verifyRunsRef.current >= 5) return;
    verifyRunsRef.current += 1;
    const cmd = await detectVerifyCommand();
    if (!cmd) return;
    addToast(`🔎 Otonom doğrulama (${verifyRunsRef.current}/5): ${cmd}`, "info");
    runInTerminal(cmd);
  }, [addToast, detectVerifyCommand]);

  const callApi = useCallback(async (
    overrideAgent?: Agent | null,
    opts?: { continuation?: boolean; depth?: number; noStrongest?: boolean },
  ) => {
    const store = useStore.getState();
    let active = store.activeModel();
    if (!active) { store.setSettingsOpen(true); return; }
    /* Otomatik efor/Ajan-Ekibi için son kullanıcı mesajı. */
    const _lastUserText = String(store.current()?.messages.findLast?.((m) => m.role === "user")?.content ?? "");
    /* Ajan Ekibi: kullanıcı elle açtıysa VEYA otomatik eşik (açıkça çok-parçalı
       ağır istek) tetiklendiyse devreye girer. Devam turlarında otomatik açılmaz. */
    /* ✦ OTOMATİK PİLOT — görünmez zeka: mod kararları (efor/web/araştırma/
       kalite/ekip) mesajdan tek noktada türetilir. Elle açılan çipler her
       zaman geçersiz kılar; devam turu ve slash-ajanlarda devreye girmez. */
    const pilotRepoCtx = !!store.repo || !!(store.config.localMode && store.config.localBridgeUrl?.trim());
    const pilot: PilotDecision | null =
      store.config.autoPilot !== false && !opts?.continuation && !overrideAgent
        ? decidePilot(_lastUserText, { hasRepo: pilotRepoCtx })
        : null;
    setLastPilot(pilot);
    const useSwarm = swarmModeRef.current
      || (pilot ? pilot.swarm : (store.config.autoSwarm !== false && !opts?.continuation && autoSwarm(_lastUserText)));
    /* Derin Araştırma: kullanıcı modu açtıysa, /research ajanı seçiliyse
       ya da Otomatik Pilot gerek gördüyse (devam turlarında değil). */
    const useResearch = (researchModeRef.current || overrideAgent?.id === "research" || !!pilot?.research) && !opts?.continuation;
    const wantWeb = !!pilot?.web;
    /* Ajan Ekibi / Araştırma turunda otomatik EN GÜÇLÜ modeli kullan (ayar açıksa)
       → en yetenekli modelle çalışır. Hata olursa (kredi/anahtar yok) aşağıdaki
       catch bloğu sessizce AKTİF modele döner ve tekrar dener. */
    let usedStrongest = false;
    if ((useSwarm || useResearch) && !opts?.noStrongest && useStore.getState().config.agentsUseStrongestModel !== false) {
      const strong = store.strongestModel();
      if (strong && strong.id !== active.id) { active = strong; usedStrongest = true; }
    }

    /* Proje-başına model/örnekleme: aktif projenin ayarları global'i geçersiz kılar. */
    const activeProjectCfg = store.config.projects.find((p) => p.id === store.config.activeProjectId);
    if (activeProjectCfg?.modelId) {
      const override = store.config.models.find((m) => m.id === activeProjectCfg.modelId);
      if (override) active = override;
    }

    /* API anahtarını ŞİMDİ çöz (active artık kesin) → sağlayıcıya asla şifreli
       blob gitmesin; çözülemezse boş + kullanıcı uyarısı (usableApiKey). */
    const reqKey = await usableApiKey(active);

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
    /* Bağlam penceresi + OTOMATİK SIKIŞTIRMA: eşik aşılınca eski mesajlar LLM ile
       tek özete damıtılır (Claude Code /compact gibi), son KEEP mesaj aynen
       gönderilir. Stored sohbet DEĞİŞMEZ (yalnızca gönderilen kopya sıkışır);
       özet çağrısı başarısızsa ham kırpmaya düşülür → akış asla bozulmaz. */
    const MAX_CTX = 60;
    const KEEP = 40;
    let apiMessages: { role: string; content: string | unknown[] }[];
    if (rawMessages.length > MAX_CTX && active) {
      const older = rawMessages.slice(0, rawMessages.length - KEEP);
      const recent = rawMessages.slice(-KEEP);
      const cacheKey = `${chat?.id ?? "_"}:${older.length}`;
      let summary = compactCacheRef.current?.key === cacheKey ? compactCacheRef.current.summary : "";
      if (!summary) {
        const transcript = older
          .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : "[görsel]"}`)
          .join("\n\n");
        try {
          const cr = await fetch("/api/compact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript,
              baseUrl: active.baseUrl,
              model: active.model,
              apiKey: reqKey,
            }),
          });
          summary = (await cr.json())?.summary || "";
          if (summary) {
            compactCacheRef.current = { key: cacheKey, summary };
            addToast("Bağlam otomatik özetlendi (uzun sohbet).", "info");
          }
        } catch { /* özetleme başarısız → ham kırpmaya düş */ }
      }
      apiMessages = summary
        ? [{ role: "system" as const, content: `[Önceki konuşmanın özeti — bağlamı koru]\n${summary}` }, ...recent]
        : [{ role: "system" as const, content: `[Bağlam notu: ${rawMessages.length} mesajdan son ${KEEP}'i gönderiliyor.]` }, ...recent];
    } else {
      apiMessages = rawMessages;
    }

    const activeProject = config.projects.find((p) => p.id === config.activeProjectId);
    /* Proje bilgi tabanı enjeksiyonu. Büyükse (RAG-lite): tüm dosyaları gömmek
       yerine soruya en ilgili parçaları getir → token tasarrufu + alaka. Küçükse
       veya eşleşme yoksa mevcut davranış (tüm dosyalar, kırpılmış). */
    const pkFiles = activeProject?.files ?? [];
    let projectKB = "";
    if (pkFiles.length) {
      const pkTotal = pkFiles.reduce((a, f) => a + f.content.length, 0);
      if (pkTotal > 8000 && _lastUserText.trim()) {
        const hits = retrieve(_lastUserText, pkFiles.map((f) => ({ name: f.name, content: f.content })), 6);
        if (hits.length) projectKB = `## Proje Bilgi Tabanı (soruya en ilgili alıntılar)\n${hits.map((h) => `### ${h.name}\n${h.chunk}`).join("\n\n")}`;
      }
      if (!projectKB) projectKB = `## Proje Bilgi Tabanı (referans dosyalar — örnek/bağlam olarak kullan)\n${pkFiles.map((f) => `### ${f.name}\n${f.content.slice(0, 6000)}${f.content.length > 6000 ? "\n…(kırpıldı)" : ""}`).join("\n\n")}`;
    }
    const coderSystemPrompt = [
      config.systemPrompt,
      CRAFT_OPERATING_MANUAL,
      agent
        ? agent.systemPrompt + ((store.toolsEnabled && (!!store.repo || (store.config.localMode && store.config.localBridgeUrl?.trim())))
            ? "\n\n[Araçlar açık] Tahmin etme — gerektiğinde read_file/read_files/grep/glob ile ilgili dosyaları incele, git_diff/git_log/git_blame ile değişiklikleri ve geçmişi gör, discover_rules ile proje kurallarını (CLAUDE.md/.rules) oku. ÖNCE keşfet, SONRA yanıtla; iddialarını dosya kanıtına dayandır."
            : "")
        : "Sen uzman bir yazılım geliştiricisisin. Claude Code tarzında çalış: kullanıcının kod tabanını anla, dosya içeriklerini incele, sorunlara adım adım yaklaş. Kod yazarken best practice'leri uygula, okunabilir ve sürdürülebilir çözümler sun. KARMAŞIK (çok adımlı) görevlerde ÖNCE update_plan ile KISA bir plan (yapılacaklar listesi) sun, sonra adım adım uygula ve her adım bitince planı güncelle.",
      activeProject?.systemPrompt?.trim() ? `## Proje: ${activeProject.name}\n${activeProject.systemPrompt.trim()}` : "",
      projectKB,
      config.rulesFile?.trim() ? `## Proje Kuralları (.rules)\n${config.rulesFile.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!isContinuation) store.pushMessage({ role: "assistant", content: "" });
    store.setFinishReasonOnLast(undefined); // bayatlamış "kesildi" şeridini temizle
    store.setStreaming(true);
    if (!isContinuation) setCheckpoints([]); // yeni tur — önceki turun geri-al noktaları sıfırlanır
    const turnCheckpoints: { path: string; previous: string | null }[] =
      isContinuation ? [...(lastMsg?.checkpoints ?? [])] : []; // devamda önceki yazmalar korunur
    setPendingActions([]); // bekleyen yıkıcı işlem önerileri
    setPendingSurvey(null); // önceki anketi temizle
    coderAbort = new AbortController();

    /* ✦ Faz 3 — Kalite güçlendirme: pilot "kalite" dediyse (araçsız, tekil
       sohbet turlarında) arka planda 1-2 iç taslak üret; nihai yanıt bunları
       eleştirip birleştirerek AKIŞLI yazılır. Ortalama model → üstün çıktı. */
    let boostDrafts: string[] = [];
    const toolsWanted = store.toolsEnabled && (!!store.repo || !!(store.config.localMode && store.config.localBridgeUrl?.trim()));
    if (pilot?.quality && !useSwarm && !useResearch && !toolsWanted && !isContinuation) {
      try {
        useStore.getState().updateLastThinking("✦ Kalite turu: iç taslak(lar) hazırlanıyor…");
        const draftProfiles = pickDraftModels(
          store.config.models, active, pilot.effort === "max" ? 2 : 1, store.strongestModel(),
        );
        const withKeys = await Promise.all(draftProfiles.map(async (m) => ({
          baseUrl: m.baseUrl, model: m.model, provider: m.provider, apiKey: await usableApiKey(m),
        })));
        boostDrafts = await generateDrafts({ userText: _lastUserText, models: withKeys, signal: coderAbort.signal });
        if (boostDrafts.length) {
          useStore.getState().updateLastThinking(`✦ Kalite turu: ${boostDrafts.length} taslak birleştiriliyor…`);
        }
      } catch { boostDrafts = []; /* güçlendirme başarısızsa normal akış */ }
    }
    const abortCtl = coderAbort;

    const thinkingMode = store.thinkingMode === "auto" ? (pilot?.effort ?? autoEffort(_lastUserText)) : store.thinkingMode;
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
    /* Çok-geçişli kalite modu: taslak → öz-eleştiri → düzeltme döngüsünü tek
       yanıt içinde uygulat (yalnızca nihai sürümü göster). */
    if (boostDrafts.length > 0) {
      finalSystemPrompt += buildBoostInstruction(boostDrafts);
    } else if (store.config.qualityMode || pilot?.quality) {
      finalSystemPrompt +=
        "\n\n[KALİTE MODU] Yanıtını üç aşamada üret ama YALNIZCA son sürümü göster: " +
        "(1) TASLAK: hızlı bir ilk çözüm düşün. " +
        "(2) ÖZ-ELEŞTİRİ: taslağındaki hataları, eksikleri, edge-case'leri ve daha iyi yaklaşımları içten değerlendir. " +
        "(3) DÜZELTME: eleştirini uygulayıp en doğru, eksiksiz ve sağlam yanıtı ver. " +
        "Taslak ve eleştiri sürecini YAZMA; sadece nihai, düzeltilmiş yanıtı sun.";
    }
    /* Öğrenme Modu: üniversite yazılım öğrencileri için eğitsel yanıt. Kodun
       yanında "neden"i, kavram tanımlarını ve sırada öğrenilecekleri ver. */
    if (store.config.learningMode) {
      finalSystemPrompt +=
        "\n\n[ÖĞRENME MODU] Kullanıcı yazılım öğrenen bir öğrenci. Yanıtını eğitsel kur: " +
        "(1) Önce kısa, sade bir genel bakışla NE yapacağını ve NEDEN bu yaklaşımı seçtiğini açıkla. " +
        "(2) Kodu adım adım, yorum satırlarıyla ver; geçen teknik terim/jargonu (ör. closure, async, big-O) parantez içinde kısaca Türkçe tanımla. " +
        "(3) Yaygın hataları/edge-case'leri ve 'neden böyle' mantığını belirt. " +
        "(4) Sonunda 'Sırada öğren' başlığıyla 2-3 ilgili kavram/kaynak öner. " +
        "Üstten bakmadan, anlaşılır ve cesaretlendirici bir dille yaz. Kod kalitesinden ödün verme.";
    }
    /* Özel yazı stili: aktifse kullanıcı tanımlı talimatları ekle (yerleşik stilin
       yerine geçer — UI seçimde ikisi karşılıklı dışlanır). */
    if (store.config.activeCustomStyleId) {
      const cs = (store.config.customStyles ?? []).find((s) => s.id === store.config.activeCustomStyleId);
      if (cs?.instructions.trim()) finalSystemPrompt += `\n\n[Stil]: ${cs.instructions.trim()}`;
    }

    const repo = store.repo;
    const activeGithub = store.activeGithub();
    const activeGitlab = store.activeGitlab();
    /* Yerel Mod: köprü tanımlı ve açıksa, github/gitlab repo'ya gerek kalmadan
       araçlar gerçek dosya sistemine + kabuğa erişir. */
    const localActive = !!(store.config.localMode && store.config.localBridgeUrl?.trim());
    const toolsEnabled = store.toolsEnabled && (!!repo || localActive);
    const activeRepo = store.config.activeRepo || "";
    const repoIsGitLab = isGitLabRepo(activeRepo);

    /* Web search pre-fetch: when searchOn, fetch Jina results before sending to AI */
    let webSearchContext = "";
    if (wantWeb) {
      const userQuery = lastUserMsg?.content ?? "";
      try {
        const wsr = await fetch(`/api/web-search?q=${encodeURIComponent(userQuery)}`, {
          signal: AbortSignal.timeout(12000),
        });
        if (wsr.ok) webSearchContext = await wsr.text();
      } catch { /* ignore — continue without search */ }
      /* Kaynakları metinden ayrıkla → yanıt altında "Kaynaklar" olarak göster. */
      const sources: { title: string; url: string }[] = [];
      for (const block of webSearchContext.split("\n\n")) {
        const lines = block.split("\n");
        const title = (lines[0] || "").replace(/^[•\-*]\s*/, "").trim();
        const url = (lines.find((l) => /^\s*https?:\/\//.test(l)) || "").trim();
        if (url && title && sources.length < 8 && !sources.some((s) => s.url === url)) sources.push({ title, url });
      }
      if (sources.length) store.setSourcesOnLast(sources);
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
      const endpoint = useResearch
        ? "/api/research"
        : useSwarm && !isContinuation ? "/api/orchestrate" : "/api/chat";
      const callViaServer = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtl.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl, model: active.model, apiKey: reqKey,
          provider: active.provider, systemPrompt: finalSystemPrompt,
          /* Çok-sağlayıcılı otomatik fallback: aktif model hata verirse sunucu
             sırayla bu ücretsiz adayları dener (kullanıcı duvara çarpmaz). */
          fallbacks: buildFallbackChain(store.config.models, active.id),
          style: store.config.style,
          memories: store.config.memories,
          skills: activeSkills.map((s) => ({
            title: s.title, content: s.content, tags: s.tags, source: s.source, fileName: s.fileName,
          })),
          tools: toolsEnabled,
          webSearch: wantWeb,
          requireWriteApproval: store.config.requireWriteApproval,
          safeMode: store.config.safeMode,
          toolPermissions: store.config.toolPermissions,
          planApprovalMode: store.config.planApprovalMode,
          planApproved: planApprovedRef.current,
          blockNetworkTools: store.config.blockNetworkTools,
          /* Terminal varsa ajana run_command aracı sunulur (uzak WS veya WebContainer). */
          terminalAvailable: localActive || !!(store.config.terminalWsUrl?.trim()) || terminalSupported,
          temperature: activeProjectCfg?.temperature,
          maxTokens: activeProjectCfg?.maxTokens,
          effort: thinkingMode,
          searchContext: webSearchContext || undefined,
          repoCtx: toolsEnabled
            ? (localActive
                ? {
                    owner: "local", repo: "local", branch: "main",
                    provider: "local",
                    bridgeUrl: store.config.localBridgeUrl,
                    bridgeToken: store.config.localBridgeToken,
                  }
                : repo
                  ? {
                      owner: repo.owner,
                      repo: repo.repo,
                      branch: repo.branch,
                      token: repoIsGitLab ? activeGitlab?.token : activeGithub?.token,
                      provider: repoIsGitLab ? "gitlab" : "github",
                    }
                  : undefined)
            : undefined,
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
      if (active.provider === "pollinations" && !toolsEnabled && !wantWeb) {
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
        if (reqKey) polHeaders["Authorization"] = `Bearer ${reqKey}`;
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
        /* Kararlılık: akış başlamadan önce geçici hatalarda (ağ kopması veya
           5xx) otomatik yeniden dene (en çok 2 kez, üstel bekleme). İptal'e
           saygılı; 4xx/429 yeniden denenmez (kalıcı/akış altında ele alınır). */
        const backoff = (n: number) => new Promise<void>((r) => {
          const t = setTimeout(r, 1000 * 2 ** (n - 1));
          abortCtl.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
        });
        let attempt = 0;
        for (;;) {
          try {
            res = await callViaServer();
            if (!res.ok && res.status >= 500 && attempt < 2 && !abortCtl.signal.aborted) {
              attempt++;
              addToast(`Sağlayıcı hatası (${res.status}) — yeniden deneniyor (${attempt}/2)…`, "info");
              await backoff(attempt);
              if (abortCtl.signal.aborted) break;
              continue;
            }
            break;
          } catch (err) {
            if ((err as Error)?.name === "AbortError") throw err;
            if (attempt < 2 && !abortCtl.signal.aborted) {
              attempt++;
              addToast(`Bağlantı hatası — yeniden deneniyor (${attempt}/2)…`, "info");
              await backoff(attempt);
              if (abortCtl.signal.aborted) throw err;
              continue;
            }
            throw err;
          }
        }
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
                fireHooks("preToolUse");
              } else if (ev.phase === "end") {
                useStore.getState().updateToolCallOnLast(ev.id, {
                  result: ev.result, status: "done",
                  endedAt: Date.now(),
                });
                fireHooks("postToolUse");
              }
              continue;
            }
            /* ajan plan (update_plan) olayı */
            if (parsed.plan_event) {
              useStore.getState().setPlanOnLast(String(parsed.plan_event.plan ?? ""));
              continue;
            }
            /* Otomatik fallback: birincil model hata verdi, sunucu ücretsiz bir
               alternatife geçti → kullanıcıyı şeffaflık için bilgilendir. */
            if (parsed.fallback_event) {
              const fp = String(parsed.fallback_event.provider ?? "");
              const fm = String(parsed.fallback_event.model ?? "");
              addToast(`Aktif model yanıt vermedi; ücretsiz alternatife geçildi: ${fp} / ${fm}`, "info");
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
              const command = String(parsed.run_command_event.command ?? "").trim();
              const lcfg = useStore.getState().config;
              /* Tehlikeli komut kalkanı: katastrofik kalıpları (rm -rf /, fork bomb,
                 mkfs, curl|sh…) çalıştırmadan engelle; engellenen komutu "Terminal"
                 kutusunda göster ve sonucu ajana geri besle (loop sürer, ajan daha
                 güvenli komutla devam eder). */
              const danger = command && lcfg.commandGuard !== false ? matchDangerousCommand(command) : null;
              if (danger) {
                addToast(`⛔ Güvenlik: komut engellendi (${danger})`, "error");
                useStore.getState().addCommandRun(command);
                window.dispatchEvent(new CustomEvent("craftai:terminal-output", { detail: { command, output: `⛔ Güvenlik politikası bu komutu engelledi: ${danger}. Komut ÇALIŞTIRILMADI. Gerçekten gerekliyse kullanıcıdan açık onay iste; aksi halde daha güvenli bir komutla devam et.` } }));
              } else {
                /* Terminali ARKAPLANDA hazırla; komut arkaplanda çalışır, ilerleme
                   sohbetteki "Terminal" todo kutusunda görünür, çıktı AI'ya döner. */
                runInTerminal(String(parsed.run_command_event.command ?? ""));
              }
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
            /* ask_user anketi: ajan tıklanabilir soru sordu → kart göster, yanıt bekle. */
            if (parsed.ask_user_event?.questions) {
              setPendingSurvey(parsed.ask_user_event.questions as SurveyQuestion[]);
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

      /* Muhakeme sızıntısını ayır: <think>/<thinking>/<reasoning> etiketleri +
         harmony kanalları (analysis→düşünce, final→içerik) + artık kontrol
         token'ları. Yalnız temizlenmiş bir içerik kaldıysa uygula (boşa düşürme). */
      {
        const { content: cleanContent, thinking } = splitReasoning(full);
        if (cleanContent && cleanContent !== full.trim()) useStore.getState().updateLastContent(cleanContent);
        if (thinking) useStore.getState().updateLastThinking(thinkingFull ? `${thinkingFull}\n\n${thinking}` : thinking);
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
      } else if (usedStrongest) {
        /* En güçlü model hata verdi (kredisi/anahtarı yok olabilir) → başarısız
           baloncuğu kaldır, AKTİF modele dön ve aynı turu bir kez daha dene.
           Kullanıcı hata görmez; noStrongest=true sonsuz döngüyü engeller. */
        useStore.getState().popLastMessage();
        useStore.getState().addToast("En güçlü model yanıt vermedi (kredi/anahtar?), aktif modele dönülüyor…", "info");
        await callApi(overrideAgent, { ...opts, noStrongest: true });
      } else {
        useStore.getState().updateLastContent(`**Hata:** ${friendlyError((err as Error).message)}`);
        void runHooks(false, "error");
      }
    } finally {
      coderAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
      /* Claude tarzı otomatik başlık: ilk tur bitince kısa AI başlığı üret
         (sessiz; yalnız başlık hâlâ varsayılan kırpma ise, sohbet başına 1 kez). */
      void (async () => {
        try {
          const st = useStore.getState();
          const chat = st.current();
          if (!chat || chat.incognito || chat.messages.length > 2) return;
          const firstUser = chat.messages.find((m) => m.role === "user");
          const raw = typeof firstUser?.content === "string" ? firstUser.content : "";
          const isDefault = chat.title === "Yeni sohbet" || (!!raw && chat.title === raw.slice(0, 48));
          if (!isDefault) return;
          const last = chat.messages[chat.messages.length - 1];
          const { quickComplete } = await import("@/lib/quickComplete");
          const t = (await quickComplete(
            `Konuşma:\nKullanıcı: ${raw.slice(0, 500)}\nAsistan: ${String(last?.content ?? "").slice(0, 500)}`,
            "Bu konuşma için 3-5 kelimelik, kısa ve net bir Türkçe başlık üret. SADECE başlığı döndür — tırnak, nokta, açıklama yok.",
          )).replace(/^["'«]+|["'»]+$/g, "").split("\n")[0].trim();
          if (t && t.length <= 60) st.renameChat(chat.id, t);
        } catch { /* sessiz — mevcut başlık kalır */ }
      })();
      if (useStore.getState().config.soundEnabled) {
        const { playReady, notifyReady } = await import("@/lib/sounds");
        playReady();
        notifyReady("Craft", "Yanıt hazır.");
      }
      void extractMemory();
      fireHooks("onStop");
    }
    /* Otomatik devam (Claude Code gibi): yanıt token sınırında kesildiyse aynı
       baloncuk içinden kendiliğinden sürdür — kullanıcı tıklamasına gerek yok.
       Sonsuz döngüye karşı en çok 8 ardışık otomatik devam. */
    const depth = opts?.depth ?? 0;
    if (cutAtLength && useStore.getState().config.autoContinue !== false && depth < 8 && !abortCtl.signal.aborted) {
      useStore.getState().addToast("Yanıt sınırda kesildi — kaldığı yerden devam ediliyor…", "info");
      await callApi(overrideAgent, { continuation: true, depth: depth + 1 });
    } else if (!abortCtl.signal.aborted) {
      /* Tur tamamlandı (sınırda kesilmedi) → olay kancalarını çalıştır. */
      await runHooks(turnCheckpoints.length > 0);
      await runAutoVerify(turnCheckpoints.length > 0);
    }
  /* callApi reads the rest of its inputs live via useStore.getState() during
     streaming, so it deliberately keeps a minimal dep set — recreating it on
     every config change would break in-flight requests. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.systemPrompt, extractMemory, runHooks, runAutoVerify]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0 && attachedFiles.length === 0) || streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) { store.setSettingsOpen(true); return; }
    if (!store.currentId) store.newChat(incognito);

    /* "skill indir <url>" — LLM'e gitmeden ANINDA otomatik içe aktarma:
       güvenli proxy'den çekilir, skill olarak eklenir, sohbete onay düşer. */
    const skillCmd = text.match(/^skill\s+(?:indir|yükle|ekle)\s+(https?:\/\/\S+)\s*$/i);
    if (skillCmd) {
      const url = skillCmd[1];
      setInput("");
      store.pushMessage({ role: "user", content: text });
      try {
        const { title, chars } = await importSkillFromUrl(url);
        store.pushMessage({
          role: "assistant",
          content: `✓ **"${title}"** skill'i eklendi (${chars.toLocaleString("tr-TR")} karakter).\n\nBundan sonra her yeni sohbette otomatik geçerli — Skills panelinden yönetebilirsin.`,
        });
      } catch (e) {
        store.pushMessage({
          role: "assistant",
          content: `✗ Skill indirilemedi: ${friendlyError((e as Error).message)}\n\nİpucu: GitHub'da dosyanın **Raw** linkini kullan.`,
        });
      }
      void store.persistCurrent();
      return;
    }
    setPendingCommit(null);
    hookRunsRef.current = 0; // yeni kullanıcı mesajı → afterEdit döngü sayacını sıfırla
    verifyRunsRef.current = 0; // otonom doğrulama tur sayacını da sıfırla
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
    /* Erken kayıt: soru, akış tamamlanmadan da kalıcı olsun — sekme dondurulup
       yeniden yüklense bile kaybolmaz. */
    void store.persistCurrent();
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
  /* Hassas veri uyarısı — yazılan istemde API anahtarı/kredi kartı/IBAN olursa. */
  const sensitiveHits = useMemo(() => detectSensitive(input), [input]);
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
            <p className="text-xs text-muted/60 mt-1">PDF · görsel · kod · metin · notebook — çoklu dosya</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div
        className="brand-rule shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 bg-surface/60 backdrop-blur-sm overflow-x-auto scrollbar-none"
        style={{ height: "calc(3rem + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
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
          <span className="text-sm font-semibold text-ink">Craft</span>
          {repo && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-bgsoft border border-line/60 text-muted/70 font-mono">
              {repo.owner}/{repo.repo}
              <span className="text-muted/40">:</span>
              <span className="text-brand/80">{repo.branch}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0" />

        {/* Token + maliyet — masaüstünde görünür (mobil header sade kalır;
           ayrıntı ⋯ menü ve Ayarlar → Kullanım'da). */}
        {config.models.length > 0 && (
          <div className="hidden sm:block shrink-0">
            <UsageBadge
              chat={current ?? {}}
              pendingTokens={
                estimateTokens(input) + attachedFiles.reduce((a, f) => a + estimateTokens(f.content), 0)
              }
            />
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <ModelSwitcher />
          {incognito && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30">
              <VenetianMask size={9} /> Gizli
            </span>
          )}
          {/* Birleşik ⋯ menüsü — gruplu: Hızlı eylemler · Çalışma Alanı · Modlar · Araçlar */}
          <MoreMenu placement="bottom" active={editorOpen || terminalOpen || gitPanelOpen || filesOpen || toolsEnabled || !!config.safeMode || swarmMode || researchMode}>
            <EffortMenuControl />
            <div className="h-px bg-line my-1" />

            <MoreItem icon={<VenetianMask size={14} />} label="Gizli sohbet" onClick={() => useStore.getState().newChat(true)} />

            {/* Sekme çubuğu — tıklanınca menü açık kalır */}
            <div className="flex gap-0.5 px-1 pt-1 pb-1" onClick={(e) => e.stopPropagation()}>
              {([["workspace", "Çalışma"], ["modes", "Modlar"], ["tools", "Araçlar"]] as const).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => setMoreTab(key)}
                  className={`flex-1 px-1.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    moreTab === key ? "bg-brand/15 text-brand" : "text-muted hover:text-ink hover:bg-bgsoft"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {/* Sekme içeriği */}
            {moreTab === "workspace" && (
              <>
                <MoreItem icon={<Code2 size={14} />} label={editorOpen ? "Editörü kapat" : "Editör (IDE)"} active={editorOpen} onClick={() => setEditorOpen((v) => !v)} />
                {isAdmin && (
                  <MoreItem
                    icon={<Terminal size={14} />}
                    label={terminalOpen ? "Terminal'i kapat" : "Terminal"}
                    desc={terminalSupported ? undefined : "masaüstü Chrome/Edge gerekir"}
                    active={terminalOpen}
                    onClick={() => { setTerminalMounted(true); setTerminalOpen((v) => !v); }}
                  />
                )}
                <MoreItem icon={<GitBranch size={14} />} label="Git & PR" desc="dal, PR/MR, incele" active={gitPanelOpen} onClick={() => setGitPanelOpen((v) => !v)} />
                <MoreItem icon={<FolderOpen size={14} />} label="Dosyalar (depo)" active={filesOpen} onClick={() => setFilesOpen((v) => !v)} />
                {localActive && (
                  <MoreItem
                    icon={<Server size={14} />}
                    label="Sunucu (workspace)"
                    active={wsOpen}
                    onClick={() => setWsOpen((v) => { const nv = !v; if (nv && !wsTree && !wsLoading) loadWorkspace(); return nv; })}
                  />
                )}
              </>
            )}

            {moreTab === "modes" && (
              <div className="px-1.5 pb-1 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                {config.autoPilot !== false && (
                  <p className="w-full text-[10px] text-muted/55 mb-0.5">✦ Otomatik Pilot açık — bunlar elle geçersiz kılar.</p>
                )}
                <ModeChip
                  icon={<Wrench size={12} />} label="Tools" active={toolsEnabled}
                  onClick={() => {
                    const store = useStore.getState();
                    if (!store.repo) { addToast("Tool-use için önce bir GitHub deposu bağla", "error"); return; }
                    store.setToolsEnabled(!store.toolsEnabled);
                  }}
                />
                <ModeChip icon={<ShieldCheck size={12} />} label="Güvenli" active={!!config.safeMode} onClick={() => useStore.getState().saveConfig({ ...config, safeMode: !config.safeMode })} />
                <ModeChip icon={<GraduationCap size={12} />} label="Öğrenme" active={!!config.learningMode} onClick={() => useStore.getState().saveConfig({ ...config, learningMode: !config.learningMode })} />
                <ModeChip icon={<Sparkles size={12} />} label="Kalite" active={!!config.qualityMode} onClick={() => useStore.getState().saveConfig({ ...config, qualityMode: !config.qualityMode })} />
                <ModeChip icon={<Users size={12} />} label="Ekip" active={swarmMode} onClick={() => setSwarmMode((v) => !v)} />
                <ModeChip icon={<Search size={12} />} label="Araştırma" active={researchMode} onClick={() => setResearchMode((v) => !v)} />
              </div>
            )}
            {moreTab === "modes" && (
              <MoreItem
                icon={improvingPrompt ? <Loader2Icon size={14} className="animate-spin" /> : <Wand2 size={14} />}
                label="Prompt geliştir"
                desc="yazdığın istemi iyileştirir"
                onClick={() => void improvePrompt()}
              />
            )}

            {moreTab === "tools" && (
              <>
                <MoreItem icon={<Zap size={14} />} label="Skills" onClick={() => useStore.getState().setSkillsOpen(true)} />
                <MoreItem icon={<BookOpen size={14} />} label="Kütüphane" onClick={() => { useStore.getState().setLibraryTab("snippets"); useStore.getState().setLibraryOpen(true); }} />
                <MoreItem icon={<Activity size={14} />} label="Etkinlik günlüğü" onClick={() => useStore.getState().setActivityOpen(true)} />
              </>
            )}
          </MoreMenu>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">

        {/* Files panel (left) — mobilde içeriği ezmesin diye overlay */}
        {filesOpen && (
          <div className="absolute sm:relative inset-y-0 left-0 z-30 w-64 sm:w-56 max-w-[85%] shrink-0 flex flex-col border-r border-line/60 bg-surface sm:bg-surface/40 shadow-2xl sm:shadow-none overflow-hidden">
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

        {/* Sunucu (Hibrit köprü) workspace gezgini — ajanların çalıştığı gerçek dizin.
            Repo panelinden bağımsız; yalnız localMode'da açılır. */}
        {wsOpen && (
          <div className="absolute sm:relative inset-y-0 left-0 z-30 w-64 sm:w-56 max-w-[85%] shrink-0 flex flex-col border-r border-line/60 bg-surface sm:bg-surface/40 shadow-2xl sm:shadow-none overflow-hidden">
            <div className="px-3 py-2 border-b border-line/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50 flex items-center gap-1.5">
                <Server size={11} className="text-brand/70" /> Sunucu • workspace
              </span>
              <div className="flex items-center gap-1">
                <button onClick={loadWorkspace} disabled={wsLoading} title="Yenile" className="text-muted/40 hover:text-brand transition-colors disabled:opacity-30">
                  <RefreshCw size={10} className={wsLoading ? "animate-spin" : ""} />
                </button>
                <button onClick={() => setWsOpen(false)} className="text-muted/40 hover:text-muted transition-colors">
                  <X size={11} />
                </button>
              </div>
            </div>

            {wsTree && wsPaths.length > 0 && (
              <div className="px-2 py-1.5 border-b border-line/40 shrink-0">
                <div className="relative">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input
                    value={wsSearch}
                    onChange={(e) => setWsSearch(e.target.value)}
                    placeholder="Workspace'te ara…"
                    className="w-full bg-bgsoft/60 rounded-lg pl-6 pr-2 py-1.5 text-[11px] outline-none focus:ring-1 ring-brand/30 placeholder:text-muted/30"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1.5">
              {wsLoading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted/60">
                  <Loader2Icon size={12} className="animate-spin" /> Yükleniyor…
                </div>
              ) : !wsTree ? (
                <div className="px-2 py-3 text-[11px] text-muted/50">
                  Workspace&apos;i yüklemek için{" "}
                  <button onClick={loadWorkspace} className="text-brand hover:underline">tıkla</button>.
                </div>
              ) : wsPaths.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-muted/50">Workspace boş.</div>
              ) : wsSearch ? (
                <div className="py-1">
                  {wsPaths
                    .filter((p) => p.toLowerCase().includes(wsSearch.toLowerCase()))
                    .slice(0, 100)
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => openWorkspaceFile({ name: p.split("/").pop() || p, path: p })}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-left rounded transition-colors text-muted/80 hover:text-ink hover:bg-bgsoft/50"
                      >
                        {wsFetching === p
                          ? <RefreshCw size={10} className="animate-spin shrink-0 text-brand" />
                          : <FileIcon name={p.split("/").pop() || p} size={10} />}
                        <span className="truncate flex-1">{p}</span>
                      </button>
                    ))}
                </div>
              ) : (
                <FileTreeNode node={wsTree} onSelect={openWorkspaceFile} attached={[]} />
              )}
            </div>

            <div className="px-3 py-2 border-t border-line/40 shrink-0 text-[10px] text-muted/40">
              {wsPaths.length > 0 ? `${wsPaths.length} dosya` : "—"}
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
          {/* overscroll-contain: sayfa geri-çekme zinciri kesilir; overflow-anchor
             kapalı: tarayıcının kaydırma-çapası akışta zıplama yapmasın (yapışma
             mantığı stickRef ile bizde). */}
          <div ref={scrollRef} onScroll={onMessagesScroll} className="flex-1 overflow-y-auto overscroll-contain" style={{ overflowAnchor: "none" }}>
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
                    <div
                      key={i}
                      className={[!isLast && "cv-msg", m.role === "user" && i > 0 && "mt-1 pt-4 border-t border-line/15"].filter(Boolean).join(" ") || undefined}
                    >
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
                      {isLastAssistant && !streaming && pendingSurvey && (
                        <SurveyCard
                          questions={pendingSurvey}
                          onSubmit={(answers, surveyQuestions) => {
                            setPendingSurvey(null);
                            const lines = answers.map((a, i) => `**${surveyQuestions[i].header}:** ${a}`);
                            useStore.getState().pushMessage({ role: "user", content: lines.join("\n") });
                            void callApi();
                          }}
                        />
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

              <input ref={fileRef} type="file" multiple accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.pdf,.ipynb" className="hidden"
                onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) readFileIntoInput(f); e.target.value = ""; }} />
              <input ref={imgRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileIntoInput(f); e.target.value = ""; }} />

              {/* Textarea — geniş, butonsuz */}
              <div className="flex items-end gap-2 bg-surface/95 backdrop-blur-sm elev-2 border border-line rounded-2xl px-4 py-3 sm:py-2.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_rgba(200,168,126,0.12)] transition-all">
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
                  onPaste={(e) => {
                    /* Claude tarzı: çok uzun yapıştırma composer'ı şişirmesin —
                       otomatik metin eki olur (bağlama aynı şekilde girer). */
                    const text = e.clipboardData.getData("text");
                    if (text.length > 4000) {
                      e.preventDefault();
                      const name = `yapistirilan-${attachedFiles.length + 1}.txt`;
                      setAttachedFiles((prev) => [...prev, { path: name, content: text }]);
                      addToast(`Uzun metin "${name}" olarak eklendi 📎`, "success");
                    }
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
                {/* Dosya & görsel ekleme — tek ikon (ataç). Web araması artık
                    Otomatik Pilot ile kendiliğinden çalışır (manuel toggle yok). */}
                <MoreMenu icon={<Paperclip size={16} />} title="Dosya ekle veya arka planda çalıştır">
                  <MoreItem icon={<Paperclip size={14} />} label="Dosya ekle" desc="kod, metin, belge" onClick={() => fileRef.current?.click()} />
                  <MoreItem icon={<ImageIcon size={14} />} label="Görsel ekle" desc="fotoğraf, ekran görüntüsü" onClick={() => imgRef.current?.click()} />
                  <MoreItem
                    icon={<Bot size={14} />}
                    label="Arka planda çalıştır"
                    desc="uzun görevi kuyruğa al, sen çalışmaya devam et"
                    onClick={() => {
                      const goal = input.trim();
                      if (!goal) { useStore.getState().addToast("Önce bir hedef/görev yaz.", "info"); return; }
                      useStore.getState().enqueueJob(goal);
                      setInput("");
                      useStore.getState().addToast("Görev arka plana alındı — bitince haber vereceğim.", "success");
                    }}
                  />
                </MoreMenu>
                {streaming ? (
                  <button onClick={stop} className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-red hover:bg-red/80 active:bg-red/70 text-white grid place-items-center transition-colors" title="Durdur">
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0}
                    className="shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-brand hover:bg-branddim active:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    <ArrowUp size={17} />
                  </button>
                )}
              </div>

              {/* Alt durum çubuğu */}
              <div className="flex flex-wrap items-center justify-end gap-y-1 mt-2 px-0.5">

                <div className="flex items-center gap-1.5 text-[11px] text-muted/50 shrink-0">
                  {config.safeMode && (
                    <span className="flex items-center gap-1 text-amber-400 font-medium" title="Salt-okunur: ajan hiçbir değişiklik yapamaz">
                      <ShieldCheck size={12} /> Güvenli
                    </span>
                  )}
                  {lastPilot?.web && <span className="flex items-center gap-1 text-brand font-medium" title="Web araması: en güncel veri internetten çekilir"><Globe size={12} /> Web</span>}
                  {/* ✦ Oto — Otomatik Pilot tek göstergesi: efor/web/araştırma/
                     kalite/ekip kararlarını craft mesajına göre kendisi verir. */}
                  {config.autoPilot !== false && (
                    <span
                      className="flex items-center gap-1 text-brand/80 font-medium"
                      title={lastPilot ? `Bu mesajda: ${lastPilot.reasons.join(" · ")}` : "Otomatik Pilot: eforu, web aramayı, araştırmayı, kaliteyi ve ajan ekibini craft seçer"}
                    >
                      <Sparkles size={12} className="animate-breathe" /> Oto
                    </span>
                  )}
                  {config.autoPilot === false && config.autoSwarm !== false && !swarmMode && (
                    <span className="flex items-center gap-1 text-muted/70 font-medium" title="Otomatik ajan açık: ihtiyaca göre tek ajan veya ajan ekibi kendiliğinden çalışır">
                      <Sparkles size={12} className="text-brand/70" /> Oto-ajan
                    </span>
                  )}
                  {swarmMode && <span className="flex items-center gap-1 text-brand font-medium" title="Ajan Ekibi: planlayıcı → paralel uzman işçiler → birleştirici"><Users size={12} /> Ekip</span>}
                  {researchMode && <span className="flex items-center gap-1 text-brand font-medium" title="Derin Araştırma: çok-kaynaklı web araması → atıflı rapor"><Search size={12} /> Araştırma</span>}
                  {toolsEnabled && <span className="text-green/80 font-medium">Tools</span>}
                  {config.learningMode && <span className="flex items-center gap-1 text-brand font-medium" title="Öğrenme Modu: adım adım eğitsel açıklama"><GraduationCap size={12} /> Öğrenme</span>}
                  {activeAgent && <span className="text-brand font-medium">{activeAgent.command}</span>}
                  {sensitiveHits.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-400 font-medium" title={`Mesajında hassas veri olabilir (${sensitiveHits.join(", ")}). API anahtarlarını/kart bilgilerini sohbete yazma.`}>
                      <ShieldCheck size={12} /> Hassas veri?
                    </span>
                  )}
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
        className={`flex items-center gap-1 sm:gap-1.5 text-[10px] font-mono px-1.5 sm:px-2 py-1 rounded-lg border mr-0.5 sm:mr-1 transition-colors hover:border-brand/40 ${
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
        <span>{total.toLocaleString()}<span className="hidden sm:inline"> tok</span></span>
        {pendingTokens > 0 && (
          <span className="hidden sm:inline text-brand/80" title="Göndermeden önce tahmini ek token">+~{pendingTokens.toLocaleString()}</span>
        )}
        {cost !== null && hasPrice && (
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="opacity-40">·</span>
            <span className={danger || warn ? "" : "text-brand/80"}>{formatCost(cost)}</span>
          </span>
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


