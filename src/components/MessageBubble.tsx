"use client";

import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertCircle, BookMarked, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleCheck, Columns, Compass, FlaskConical, GitPullRequest, Image as ImageIcon, ImageOff, ListChecks, Microscope, MoreHorizontal, Settings2,
  Code2, Copy, FileText, FolderOpen, GitBranch, GitCommit, Globe,
  Highlighter, Loader2, Pencil, RefreshCw, Search, Sparkles, Terminal as TerminalIcon, ThumbsDown, ThumbsUp, Users, Volume2, VolumeX, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatMessage, CompareResult, FileCheckpoint, SwarmState } from "@/lib/types";
import { skillFromText } from "@/lib/skillImport";
import { looksLikeSkillMd } from "@/lib/odFormat";
import { redactSecrets } from "@/lib/pii";
import { useStore } from "@/lib/store";
import { CodeBlock } from "./CodeBlock";
import { ALL_AGENTS } from "@/lib/agents";
import { playTts, speakableText, stopTts } from "@/lib/pollinations";
import { toggleChecklistLine } from "@/lib/checklist";
import { detectLanguage } from "@/lib/editor";

/* `<li>` (task-list-item) render'ında bulunan güvenilir satır numarasını,
   içindeki checkbox `<input>`'a taşımak için — bkz. MessageBubbleImpl'deki
   ReactMarkdown components.li/input. */
const ChecklistLineContext = createContext<number | undefined>(undefined);

/* ── Kod-fence dili normalizasyonu ─────────────────────────────────────
   AI, kod bloğunu `dil:dosya/yolu` biçiminde yazabilir (sistem prompt'u bunu
   ister → editörde otomatik açılsın). Ama `language-ts:src/app.ts` sınıfını
   rehype-highlight TANIMAZ → syntax highlight kaybolur ve başlıkta dil yerine
   tüm yol görünür. Bu remark plugin highlight'tan ÖNCE çalışıp code düğümünün
   dilini temiz dile (ts) indirger ve dosya yolunu `data-file` olarak saklar
   (CodeBlock başlıkta gösterir). Ham markdown'dan dosya çıkaran parsers.ts
   etkilenmez (o string üzerinde çalışır). */
interface MdNode {
  type?: string;
  lang?: string | null;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdNode[];
}
function remarkSplitFileLang() {
  const walk = (node: MdNode) => {
    if (node.type === "code" && typeof node.lang === "string" && node.lang.includes(":")) {
      const colon = node.lang.indexOf(":");
      const file = node.lang.slice(colon + 1).trim();
      node.lang = node.lang.slice(0, colon).trim() || null;
      if (file) {
        node.data = node.data ?? {};
        node.data.hProperties = { ...(node.data.hProperties ?? {}), "data-file": file };
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

/* ── Tool metadata ─────────────────────────────────────────────────── */

const TOOL_LABEL: Record<string, string> = {
  read_file:          "Dosya okunuyor",
  read_files:         "Dosyalar okunuyor",
  list_files:         "Dosyalar listeleniyor",
  glob:               "Dosya aranıyor",
  grep:               "Kod içeriği aranıyor",
  search_files:       "Dosya yolu aranıyor",
  search_code:        "Kod içeriği aranıyor",
  write_file:         "Dosya yazılıyor",
  str_replace:        "Dosya düzenleniyor",
  delete_file:        "Silme önerisi",
  rename_file:        "Yeniden adlandırma önerisi",
  list_branches:      "Dallar listeleniyor",
  create_branch:      "Dal oluşturuluyor",
  get_commit_history: "Commit geçmişi alınıyor",
  web_search:         "Web'de aranıyor",
  read_url:           "Sayfa okunuyor",
  dispatch_agents:    "Alt ajanlar çalışıyor",
  update_plan:        "Plan güncelleniyor",
  create_pr:          "PR oluşturuluyor",
  generate_image:     "Görsel üretiliyor",
  deep_research:      "Derinlemesine araştırılıyor",
  run_command:        "Komut çalıştırılıyor",
};

const TOOL_DONE_LABEL: Record<string, string> = {
  read_file:          "Okundu",
  read_files:         "Okundu",
  list_files:         "Listelendi",
  glob:               "Bulundu",
  grep:               "Arandı",
  search_files:       "Arandı",
  search_code:        "Arandı",
  write_file:         "Yazıldı",
  str_replace:        "Düzenlendi",
  delete_file:        "Silme önerildi",
  rename_file:        "Taşıma önerildi",
  list_branches:      "Listelendi",
  create_branch:      "Oluşturuldu",
  run_command:        "Çalıştırıldı",
  get_commit_history: "Alındı",
  web_search:         "Arandı",
  read_url:           "Okundu",
  dispatch_agents:    "Tamamlandı",
  update_plan:        "Plan güncellendi",
  create_pr:          "PR oluşturuldu",
  generate_image:     "Görsel üretildi",
  deep_research:      "Araştırma tamamlandı",
};

function ToolIcon({ name, size = 11 }: { name: string; size?: number }) {
  switch (name) {
    case "read_file":
    case "read_files":        return <FileText size={size} />;
    case "list_files":        return <FolderOpen size={size} />;
    case "glob":
    case "search_files":      return <Search size={size} />;
    case "grep":
    case "search_code":       return <Code2 size={size} />;
    case "write_file":        return <FileText size={size} className="text-green" />;
    case "str_replace":       return <Pencil size={size} className="text-brand" />;
    case "list_branches":
    case "create_branch":     return <GitBranch size={size} />;
    case "get_commit_history":return <GitCommit size={size} />;
    case "web_search":
    case "read_url":          return <Globe size={size} />;
    case "dispatch_agents":   return <Loader2 size={size} className="text-purple" />;
    case "update_plan":       return <ListChecks size={size} className="text-brand" />;
    case "generate_image":    return <ImageIcon size={size} className="text-brand" />;
    case "deep_research":     return <Microscope size={size} className="text-purple" />;
    default:                  return <Wrench size={size} />;
  }
}

function getKeyArg(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read_file":
    case "write_file":
    case "str_replace":
    case "delete_file":   return String(args.path ?? "");
    case "rename_file":   return String(args.path ?? "");
    case "create_branch": return String(args.name ?? "");
    case "glob":
    case "search_files":
    case "grep":
    case "search_code":   return `"${args.query ?? args.pattern ?? ""}"${args.extension ? ` (.${args.extension})` : ""}`;
    case "web_search":    return `"${args.query}"`;
    case "read_url": {
      const u = String(args.url ?? "");
      try { return new URL(u).hostname; } catch { return u.slice(0, 50); }
    }
    case "list_files":    return args.filter ? `*${args.filter}*` : "";
    case "generate_image": return `"${String(args.prompt ?? "").slice(0, 60)}"`;
    case "deep_research":  return `"${String(args.topic ?? "").slice(0, 60)}"`;
    default: return "";
  }
}

/* str_replace'in TAM yeni dosya içeriği yok — yalnız old_string/new_string.
   Ama old_string sunucuda BENZERSİZ+birebir eşleşme şartıyla doğrulanmış
   (aksi halde araç hata döner) — bu yüzden checkpoint'teki eski tam içerik
   üzerinde AYNI değişimi istemci tarafında güvenle tekrarlayıp diff için tam
   "sonra" içeriğini yeniden kurabiliriz. old_string bulunamazsa (ör. checkpoint
   farklı bir çağrıya aitse) null döner — YANLIŞ bir diff göstermek yerine
   Diff butonu gizlenir. */
function applyStrReplace(original: string, oldStr: string, newStr: string, all: boolean): string | null {
  if (!oldStr || !original.includes(oldStr)) return null;
  return all ? original.split(oldStr).join(newStr) : original.replace(oldStr, newStr);
}

function ToolCallCard({
  call,
  isLast,
  checkpoints,
}: {
  call: NonNullable<ChatMessage["toolCalls"]>[number];
  isLast: boolean;
  checkpoints?: FileCheckpoint[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isRunning = call.status === "pending";
  const isError = call.status === "error";
  const args = (() => { try { return JSON.parse(call.arguments || "{}"); } catch { return {}; } })();
  const label = isRunning ? (TOOL_LABEL[call.name] ?? call.name) : (TOOL_DONE_LABEL[call.name] ?? call.name);
  const keyArg = getKeyArg(call.name, args);
  const elapsed =
    call.startedAt && call.endedAt && call.endedAt > call.startedAt
      ? call.endedAt - call.startedAt >= 1000
        ? ((call.endedAt - call.startedAt) / 1000).toFixed(1) + "s"
        : (call.endedAt - call.startedAt) + "ms"
      : null;

  /* Dosya düzenlemelerinde (write_file/str_replace) gerçek bir diff — Claude
     Code'daki gibi. write_file'ın yeni içeriği zaten `content` argümanında tam
     olarak var; str_replace'inki checkpoint'in eski içeriğine uygulanarak
     yeniden kurulur (yukarıdaki not). */
  const diffInfo = (() => {
    if (isRunning || isError) return null;
    if (call.name !== "write_file" && call.name !== "str_replace") return null;
    const path = String(args.path ?? "");
    if (!path) return null;
    const cp = checkpoints?.find((c) => c.path === path);
    if (!cp) return null;
    if (call.name === "write_file") {
      return { path, original: cp.previous ?? "", newCode: String(args.content ?? "") };
    }
    if (cp.previous == null) return null;
    const newCode = applyStrReplace(cp.previous, String(args.old_string ?? ""), String(args.new_string ?? ""), !!args.replace_all);
    if (newCode == null) return null;
    return { path, original: cp.previous, newCode };
  })();

  const copyResult = async () => {
    if (!call.result) return;
    try {
      await navigator.clipboard.writeText(call.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* yoksay */ }
  };

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-[10px] top-[22px] bottom-0 w-px bg-line/20 pointer-events-none" />
      )}
      <div className="flex items-start gap-2.5 py-[3px] min-w-0 group/tool">
        <div className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
          {isRunning ? (
            <Loader2 size={11} className="animate-spin text-brand" />
          ) : isError ? (
            <div className="w-4 h-4 rounded-full bg-red/10 border border-red/40 flex items-center justify-center">
              <AlertCircle size={9} className="text-red/80" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-bgsoft border border-line/50 flex items-center justify-center">
              <Check size={7} className="text-green/70" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 py-0.5">
          <span className={`shrink-0 ${isRunning ? "text-brand" : "text-muted/40"}`}>
            <ToolIcon name={call.name} size={11} />
          </span>
          <span className={`text-[11px] font-medium shrink-0 ${isRunning ? "text-ink/70" : "text-muted/50"}`}>
            {label}
          </span>
          {keyArg && (
            <code className={`text-[11px] font-mono truncate min-w-0 ${isRunning ? "text-brand/70" : "text-muted/40"}`}>
              {keyArg}
            </code>
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {elapsed && (
              <span className="text-[10px] text-muted/30 font-mono tabular-nums mr-0.5">{elapsed}</span>
            )}
            <div className="flex items-center gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tool:opacity-100 transition-opacity">
              {diffInfo && (
                <button
                  onClick={() => useStore.getState().setDiffModal({ path: diffInfo.path, original: diffInfo.original, newCode: diffInfo.newCode, language: detectLanguage(diffInfo.path) })}
                  title="Değişikliği diff olarak gör"
                  className="flex items-center gap-0.5 text-[10px] text-muted/40 hover:text-brand px-1 py-0.5 rounded"
                >
                  <FileText size={9} /> Diff
                </button>
              )}
              {call.result && (
                <button
                  onClick={copyResult}
                  title="Çıktıyı kopyala"
                  className="flex items-center gap-0.5 text-[10px] text-muted/40 hover:text-muted/70 px-1 py-0.5 rounded"
                >
                  {copied ? <Check size={9} /> : <Copy size={9} />}
                </button>
              )}
              {call.result && (
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="flex items-center gap-0.5 text-[10px] text-muted/40 hover:text-muted/70 px-1 py-0.5 rounded"
                >
                  {open ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {open && call.result && (
        <div className="ml-7 mb-1.5 rounded-lg bg-bgsoft/50 border border-line/20 px-2.5 py-2">
          <pre className="font-mono text-[10px] text-muted/60 whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
            {call.result}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Görevler paneli (update_plan) ─────────────────────────────────────
   Öncesinde bu veri (`message.plan`) İKİ farklı bileşende, İKİ farklı
   ayrıştırıcıyla render ediliyordu (burada + CoderView.tsx'in ayrı
   TaskPanel'i) — aynı satır ikisinde farklı yorumlanabiliyordu (ör.
   "- [x] adım" burada ham metin olarak sızarken orada doğru "tamamlandı"
   sayılıyordu). Tek doğruluk kaynağı için birleştirildi; ayrıştırıcı
   update_plan'ın tools.ts'teki gerçek sözleşmesiyle ('[ ]'/'[~]'/'[x]',
   opsiyonel '-'/'*' madde imi) eşleşir. */
type PlanStepStatus = "pending" | "active" | "done";
function parsePlanSteps(plan: string): { status: PlanStepStatus; text: string }[] {
  return plan
    .split("\n")
    .map((line) => {
      const m = line.match(/^\s*(?:[-*]\s*)?\[([ ~xX])\]\s*(.*)$/);
      if (!m) return null;
      const mark = m[1].toLowerCase();
      const status: PlanStepStatus = mark === "x" ? "done" : mark === "~" ? "active" : "pending";
      return { status, text: m[2].trim() };
    })
    .filter((s): s is { status: PlanStepStatus; text: string } => s !== null && s.text.length > 0);
}

function PlanPanel({ plan, streaming }: { plan: string; streaming?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const steps = parsePlanSteps(plan);
  if (!steps.length) return null;
  const done = steps.filter((s) => s.status === "done").length;
  const allDone = done === steps.length;
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs hover:bg-bgsoft/40 transition-colors"
      >
        <ListChecks size={12} className={allDone ? "text-green" : "text-brand"} />
        <span className="font-semibold">Görevler</span>
        <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{steps.length}</span>
        {streaming && !allDone && <Loader2 size={11} className="animate-spin text-brand/70" />}
        <ChevronDown size={12} className={`text-muted/40 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-3 py-2.5 space-y-1.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {s.status === "done" ? (
                <CircleCheck size={12} className="text-green shrink-0 mt-0.5" />
              ) : s.status === "active" ? (
                <Loader2 size={12} className="text-brand shrink-0 mt-0.5 animate-spin" />
              ) : (
                <Circle size={12} className="text-muted/30 shrink-0 mt-0.5" />
              )}
              <span className={
                s.status === "done" ? "text-muted/50 line-through" :
                s.status === "active" ? "text-ink font-medium" :
                "text-muted/70"
              }>
                {s.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Ajan Ekibi (Swarm) ilerleme paneli ────────────────────────────── */

/* Emoji yerine lucide ikonları — panelin geri kalanı (Loader2/Check/X/
   Users/Search) zaten lucide; emoji/ikon karışımı tutarsız duruyordu. */
const SWARM_ROLE_ICON: Record<string, LucideIcon> = {
  mimar: Compass,
  kodlayıcı: Code2,
  test: FlaskConical,
  inceleyici: Search,
  araştırmacı: Microscope,
  genel: Settings2,
};

const SWARM_PHASE_LABEL: Record<SwarmState["phase"], string> = {
  planning: "Görevler planlanıyor…",
  working: "Ajanlar çalışıyor…",
  synthesizing: "Sonuçlar birleştiriliyor…",
  done: "Ajan ekibi tamamlandı",
};

/* Derin Araştırma için araştırma-odaklı faz etiketleri (aynı panel, farklı dil). */
const RESEARCH_PHASE_LABEL: Record<SwarmState["phase"], string> = {
  planning: "Alt sorgular hazırlanıyor…",
  working: "Kaynaklar taranıyor…",
  synthesizing: "Rapor yazılıyor…",
  done: "Araştırma tamamlandı",
};

function SwarmPanel({ swarm }: { swarm: SwarmState }) {
  const { phase, agents } = swarm;
  const isResearch = swarm.kind === "research";
  const done = agents.filter((a) => a.status === "done").length;
  const active = phase !== "done";
  const HeaderIcon = isResearch ? Search : Users;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs">
        <HeaderIcon size={12} className={active ? "text-brand animate-pulse" : "text-green"} />
        <span className="font-semibold">{isResearch ? "Derin Araştırma" : "Ajan Ekibi"}</span>
        <span className="text-muted/60">· {(isResearch ? RESEARCH_PHASE_LABEL : SWARM_PHASE_LABEL)[phase]}</span>
        {agents.length > 0 && (
          <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{agents.length}</span>
        )}
      </div>
      {phase === "planning" && agents.length === 0 ? (
        <div className="px-3 py-2.5 flex items-center gap-2 text-xs text-muted/70">
          <Loader2 size={12} className="animate-spin text-brand" />
          <span>{isResearch ? "Alt sorgular belirleniyor…" : "Görevler belirleniyor…"}</span>
        </div>
      ) : (
        <div className="px-3 py-2.5 space-y-1.5">
          {agents.map((a, i) => {
            const RoleIcon = SWARM_ROLE_ICON[a.role] ?? Settings2;
            const canExpand = a.status !== "running" && !!a.output;
            const isOpen = openIdx === i;
            return (
            <div key={i}>
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className={`w-full flex items-start gap-2 text-xs text-left ${canExpand ? "cursor-pointer" : "cursor-default"}`}
              >
                <RoleIcon size={13} className="text-muted/70 shrink-0 mt-0.5" />
                {a.status === "done" ? (
                  <Check size={12} className="text-green shrink-0 mt-0.5" />
                ) : a.status === "error" ? (
                  <X size={12} className="text-red shrink-0 mt-0.5" />
                ) : (
                  <Loader2 size={12} className="text-brand shrink-0 mt-0.5 animate-spin" />
                )}
                <span className={`flex-1 min-w-0 ${
                  a.status === "done" ? "text-muted/60" :
                  a.status === "error" ? "text-red/80" :
                  "text-ink font-medium"
                }`}>
                  {a.title}
                </span>
                {canExpand && (
                  <ChevronDown size={12} className={`text-muted/40 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                )}
              </button>
              {isOpen && a.output && (
                <div className="mt-1.5 ml-5 mr-1 px-2.5 py-2 rounded-lg bg-bg/50 border border-line/30 text-[11px] text-muted/80 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {a.output}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Terminal komut kutusu (todo) ──────────────────────────────────── */

function CommandRow({ cmd }: { cmd: NonNullable<ChatMessage["commands"]>[number] }) {
  const [open, setOpen] = useState(false);
  const hasOutput = !!cmd.output?.trim();
  return (
    <div className="text-xs">
      <button
        onClick={() => hasOutput && setOpen((o) => !o)}
        className={`w-full flex items-start gap-2 text-left ${hasOutput ? "cursor-pointer" : "cursor-default"}`}
      >
        {cmd.status === "running" ? (
          <Loader2 size={12} className="text-brand shrink-0 mt-0.5 animate-spin" />
        ) : cmd.status === "error" ? (
          <X size={12} className="text-red shrink-0 mt-0.5" />
        ) : (
          <Check size={12} className="text-green shrink-0 mt-0.5" />
        )}
        <code className={`flex-1 min-w-0 font-mono break-all ${cmd.status === "running" ? "text-ink" : "text-muted/80"}`}>
          $ {cmd.command}
        </code>
        {hasOutput && (open ? <ChevronUp size={12} className="text-muted/40 shrink-0 mt-0.5" /> : <ChevronDown size={12} className="text-muted/40 shrink-0 mt-0.5" />)}
      </button>
      {hasOutput && open && (
        <pre className="mt-1 ml-5 px-2.5 py-1.5 rounded-lg bg-codebg border border-line/40 text-[11px] font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto text-muted/80">
          {cmd.output}
        </pre>
      )}
    </div>
  );
}

function CommandPanel({ commands }: { commands: NonNullable<ChatMessage["commands"]> }) {
  if (!commands.length) return null;
  const running = commands.some((c) => c.status === "running");
  const done = commands.filter((c) => c.status !== "running").length;
  /* L1: aynı panel hem terminal komutlarını hem run_code (analiz aracı)
     çalıştırmalarını gösterir — tümü kod ise başlığı buna göre değiştir
     (Python/JS çalıştırmayı "Terminal" diye etiketlemek yanıltıcıydı). */
  const allCode = commands.every((c) => c.kind === "code");
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs">
        <TerminalIcon size={12} className={running ? "text-brand animate-pulse" : "text-green"} />
        <span className="font-semibold">{allCode ? "Kod çalıştırma" : "Terminal"}</span>
        <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{commands.length}</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        {commands.map((c, i) => <CommandRow key={i} cmd={c} />)}
      </div>
    </div>
  );
}

/* ── Tool call group ───────────────────────────────────────────────── */

function ToolCallGroup({ calls, checkpoints }: { calls: NonNullable<ChatMessage["toolCalls"]>; checkpoints?: FileCheckpoint[] }) {
  const running = calls.filter((c) => c.status === "pending");
  const done    = calls.filter((c) => c.status !== "pending");
  const [collapsed, setCollapsed] = useState(false);

  const headerText = running.length > 0
    ? running.length > 1 ? `${running.length} işlem çalışıyor…` : "Çalışıyor…"
    : `${calls.length} işlem tamamlandı`;

  const totalMs = done.reduce((sum, c) => {
    if (c.startedAt && c.endedAt && c.endedAt > c.startedAt) return sum + (c.endedAt - c.startedAt);
    return sum;
  }, 0);
  const totalElapsed = done.length === calls.length && totalMs > 0
    ? totalMs >= 1000 ? (totalMs / 1000).toFixed(1) + "s" : totalMs + "ms"
    : null;

  const readFiles = calls
    .filter((c) => c.name === "read_file")
    .map((c) => { try { return JSON.parse(c.arguments || "{}").path as string; } catch { return ""; } })
    .filter(Boolean);

  return (
    <div className="mb-3 border border-line/30 rounded-xl overflow-hidden bg-bgsoft/20">
      <button
        onClick={() => { if (running.length === 0) setCollapsed((v) => !v); }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/30 transition-colors text-left"
      >
        {running.length > 0
          ? <Loader2 size={10} className="animate-spin text-brand shrink-0" />
          : <Check size={10} className="text-green/60 shrink-0" />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/50 flex-1">{headerText}</span>
        {totalElapsed && (
          <span className="text-[10px] text-muted/30 font-mono tabular-nums mr-1">{totalElapsed}</span>
        )}
        {readFiles.length > 1 && running.length === 0 && (
          <span className="text-[10px] text-muted/30 mr-1">{readFiles.length} dosya</span>
        )}
        {running.length === 0 && (
          collapsed
            ? <ChevronRight size={10} className="text-muted/30 shrink-0" />
            : <ChevronDown size={10} className="text-muted/30 shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pt-0.5 pb-1">
          {calls.map((tc, i) => (
            <ToolCallCard key={tc.id} call={tc} isLast={i === calls.length - 1} checkpoints={checkpoints} />
          ))}
        </div>
      )}

      {!collapsed && readFiles.length > 1 && done.length === calls.length && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {readFiles.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue/8 text-blue/60 font-mono">
              <FileText size={9} /> {f.split("/").pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AI görsel üretimi (ChatGPT/Gemini tarzı) ──────────────────────────
   Pollinations/BYOK görselleri İSTEK ANINDA üretilir (statik dosya değil) —
   bu yüzden `<img>` yüklenmesi birkaç saniyeden 30sn+'ye kadar sürebilir.
   CANLIDA DOĞRULANDI (curl ile): aynı anonim istemciden art arda hızlı 2-3
   istek gönderilince Pollinations üçüncü isteği SESSİZCE ASIYOR (ne hata ne
   yanıt — 30sn+ sıfır bayt), birkaç saniye soğumadan sonra normale dönüyor.
   Bu yüzden ESKİ kısa gecikmeler (1.5sn/3sn) sorunu ÇÖZMÜYOR, muhtemelen
   ONU TETİKLİYORDU (hâlâ kısıtlı/aşırı-yüklü uca hemen tekrar vurmak). Artık:
   (1) çok daha uzun, katlanarak artan bekleme (4/9/16sn) — uca soğuma payı
   verir; (2) yeniden denemede `enhance` parametresi düşürülür (Pollinations
   tarafında ekstra bir LLM-yeniden-yazma adımı — gecikmeyi/yükü azaltır,
   canlıda enhance'siz istek tutarlı biçimde daha hızlı döndü); (3) açık bir
   yükleme zaman aşımı (25sn) — `<img>`'ın kendi ağ zaman aşımı çok uzun/
   belirsiz olabileceğinden (tarayıcıya göre değişir), sessiz asılı kalma
   yerine kendi retry/hata döngümüzü devreye sokar. */
const IMAGE_AUTO_RETRY_DELAYS_MS = [4000, 9000, 16000];
const IMAGE_LOAD_TIMEOUT_MS = 25000;

/* `key`'i çağıran tarafta `src`'e bağlayarak (bkz. kullanım yeri) prompt
   değişince bileşen tamamen yeniden monte olur — durumu sıfırlamak için
   ayrı bir "prop değişince state resetle" effect'ine gerek kalmaz. */
function GeneratedImage({ src, alt }: { src: string; alt?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [bust, setBust] = useState(0);
  const autoRetriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
  };
  useEffect(() => clearTimers, []);

  const handleError = () => {
    clearTimers();
    if (autoRetriesRef.current < IMAGE_AUTO_RETRY_DELAYS_MS.length) {
      const delay = IMAGE_AUTO_RETRY_DELAYS_MS[autoRetriesRef.current];
      autoRetriesRef.current += 1;
      retryTimerRef.current = setTimeout(() => setBust((b) => b + 1), delay);
    } else {
      setStatus("error");
    }
  };

  const retryManually = () => {
    clearTimers();
    autoRetriesRef.current = 0;
    setStatus("loading");
    setBust((b) => b + 1);
  };

  /* Her deneme (bust değişince) yeni bir zaman-aşımı penceresi başlatır;
     onLoad/onError bu pencere BİTMEDEN tetiklenirse effect temizlenince
     iptal olur. */
  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(() => { if (status === "loading") handleError(); }, IMAGE_LOAD_TIMEOUT_MS);
    loadTimeoutRef.current = t;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız deneme değişince (bust) yeniden başlat
  }, [bust]);

  /* Deneme 0: istek sahibinin verdiği tam URL (enhance dahilse kalır).
     Sonraki denemeler: cache-bust + `enhance` düşürülür (bkz. üstteki not). */
  const loadSrc = (() => {
    if (bust === 0) return src;
    try {
      const u = new URL(src);
      u.searchParams.delete("enhance");
      u.searchParams.set("_r", String(bust));
      return u.toString();
    } catch {
      return `${src}${src.includes("?") ? "&" : "?"}_r=${bust}`;
    }
  })();

  return (
    <div className="relative w-full max-w-[280px] aspect-square overflow-hidden rounded-xl border border-line bg-surface mb-3">
      {status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={bust}
          src={loadSrc}
          alt={alt ?? ""}
          onLoad={() => { clearTimers(); setStatus("loaded"); }}
          onError={handleError}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center gap-2 shimmer">
          <Sparkles size={20} className="text-brand animate-breathe" />
          <span className="text-[11px] text-muted font-medium">Görsel oluşturuluyor…</span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center gap-2 bg-bgsoft px-4 text-center">
          <ImageOff size={18} className="text-muted" />
          <span className="text-[11px] text-muted">Görsel oluşturulamadı</span>
          <button
            onClick={retryManually}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim transition-colors"
          >
            <RefreshCw size={11} /> Tekrar dene
          </button>
        </div>
      )}
    </div>
  );
}

/* Karşılaştırma modu — aynı mesaj birden fazla modelle paralel çalıştırılınca
   normal metin yerine bu yatay-kaydırmalı sütunlar gösterilir. Her sütun kendi
   modelini/hatasını taşır; "Bunu kullan" seçilen içeriği mesajın gerçek
   content'i yapıp compareResults'ı temizler (bkz. store.ts pickCompareResult). */
function CompareColumns({ results, onPick }: { results: CompareResult[]; onPick?: (resultIndex: number) => void }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
      {results.map((r, i) => (
        <div key={i} className="shrink-0 w-[82vw] max-w-[320px] sm:w-[300px] snap-start rounded-xl border border-line bg-bgsoft/60 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-line/60 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Columns size={11} className="text-brand shrink-0" />
            <span className="truncate" title={r.label}>{r.label}</span>
          </div>
          <div className="px-3 py-2.5 text-[13px] leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap flex-1">
            {r.error
              ? <span className="text-red text-xs">Başarısız: {r.error}</span>
              : r.content || <span className="text-muted/50 text-xs">Boş yanıt</span>}
          </div>
          {onPick && !r.error && r.content && (
            <button
              onClick={() => onPick(i)}
              className="flex items-center justify-center gap-1.5 mx-3 mb-2.5 py-1.5 rounded-lg bg-brand text-[#111110] text-xs font-semibold hover:bg-branddim transition-colors"
            >
              <Check size={12} /> Bunu kullan
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── MessageBubble ─────────────────────────────────────────────────── */

function MessageBubbleImpl({
  message,
  index,
  chatId,
  showRegenerate,
  onRegenerate,
  onContinue,
  onEdit,
  onSwitchVersion,
  streamingNow,
  onChecklistToggle,
  onPickCompare,
  onPostToPr,
  animateIn,
}: {
  message: ChatMessage;
  index: number;
  chatId?: string;
  showRegenerate?: boolean;
  /** modelId verilirse yanıt O modelle yeniden üretilir (N2). */
  onRegenerate?: (modelId?: string) => void;
  onContinue?: () => void;
  onEdit?: (index: number, content: string) => void;
  onSwitchVersion?: (branchIndex: number) => void;
  streamingNow?: boolean;
  onChecklistToggle?: () => void;
  onPickCompare?: (resultIndex: number) => void;
  /** Bu yanıtı GitHub/GitLab'da bağlı bir PR/MR'a yorum olarak gönder — yalnız
      asistan mesajlarında ve bir repo bağlıyken sunulur (bkz. CoderView.tsx). */
  onPostToPr?: () => void;
  /** S2 — giriş animasyonu YALNIZCA bu turda gelen mesajlara verilir. Eskiden
      her baloncukta koşulsuz `animate-fade-in` vardı; CSS animasyonu mount'ta
      çalıştığı için sohbet her açıldığında tüm geçmiş yeniden animasyonlanıyordu.
      Kaynak: CoderView'daki `enterFrom` eşiği. */
  animateIn?: boolean;
}) {
  const isUser = message.role === "user";
  const enterCls = animateIn ? (message.role === "user" ? " msg-enter msg-enter-user" : " msg-enter msg-enter-ai") : "";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  /* Düşünce süreci artık sohbet akışında açık durmuyor — küçük bir "•••"
     tetikleyici, tıklayınca yanıtın üstünde açılan camsı bir pano açar. */
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const thinkRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rateMessage = useStore((s) => s.rateMessage);
  const addSkill = useStore((s) => s.addSkill);
  const addHighlight = useStore((s) => s.addHighlight);
  const addToast = useStore((s) => s.addToast);
  const [speakingTts, setSpeakingTts] = useState(false);
  const speakingRef = useRef(false);
  /* N2 — "farklı modelle yeniden dene": aktif model DIŞINDAKİ eklenmiş modeller.
     Boşsa (tek model) yeniden üret düğmesi eskisi gibi doğrudan çalışır. */
  const [regenOpen, setRegenOpen] = useState(false);
  /* DİKKAT: selector içinde .filter() KULLANMA — her okumada yeni bir dizi
     referansı döner, Zustand'ın Object.is karşılaştırması bunu "değişti" sanar
     ve sonsuz render döngüsüne ("Maximum update depth exceeded") girer. Kararlı
     referansları seç, türetmeyi useMemo ile yap. */
  const allModels = useStore((s) => s.config.models);
  const activeModelId = useStore((s) => s.config.activeModelId);
  const otherModels = useMemo(
    () => allModels.filter((m) => m.id !== activeModelId),
    [allModels, activeModelId],
  );
  const [skillSaveOpen, setSkillSaveOpen] = useState(false);
  const [skillTitle, setSkillTitle] = useState("");
  const [skillContent, setSkillContent] = useState("");

  /* Ö4: başlık/içerik artık "skill indir" ve Sunucu panelindeki kaydetmeyle
     AYNI dönüşümden geçiyor (skillFromText). Kazanç: yanıt SKILL.md
     biçimindeyse (--- frontmatter) başlık gerçek `name` alanından gelir,
     etiketler dolar; düz metinde ilk markdown başlığı kullanılır.
     Eski hâli ilk SATIRI başlık yapıyor ve içeriği 4000 karakterde
     KESİYORDU — uzun bir workflow yarım kaydediliyordu. */
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const openSkillSave = () => {
    const parsed = skillFromText(message.content, "sohbet", ["sohbet"]);
    setSkillTitle(parsed.title);
    setSkillContent(parsed.content);
    setSkillTags(parsed.tags);
    setSkillSaveOpen(true);
  };

  const saveSkill = () => {
    if (!skillTitle.trim()) return;
    addSkill({ title: skillTitle.trim(), content: skillContent, tags: skillTags, enabled: true, source: "manual" });
    addToast("Skill kaydedildi", "success");
    setSkillSaveOpen(false);
  };

  /* Vurgula (Readwise'dan ilham): balondaki SEÇİLİ metni, seçim yoksa
     yanıtın başını kaydeder. Seçim, buton mousedown'unda (odak değişip
     seçim temizlenmeden) okunur — preventDefault seçimi korur. */
  const saveHighlight = () => {
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    const text = sel || message.content.replace(/^#+\s*/, "").slice(0, 280);
    if (!text) return;
    const chatTitle = chatId ? useStore.getState().chats.find((c) => c.id === chatId)?.title : undefined;
    addHighlight(text, chatTitle || "Sohbet");
    addToast("Vurgu kaydedildi — Kartlar → Vurgular'da.", "success");
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* yoksay */ }
  };

  /* GFM işaretleme kutuları (`- [ ] madde`) react-markdown'da varsayılan
     olarak disabled render edilir — tıklanamaz. Burada gerçek metindeki
     satırı (ChecklistLineContext üzerinden `<li>`'den gelen güvenilir
     satır numarası) bulup [ ]/[x] arasında değiştiriyoruz ve dallanma
     YARATMADAN mesaj içeriğine geri yazıyoruz. */
  const toggleContentCheckbox = (line?: number) => {
    if (typeof line !== "number") return;
    const next = toggleChecklistLine(message.content, line);
    if (next === message.content) return;
    useStore.getState().updateMessageContentAt(index, next);
    /* Claude tarzı: kullanıcı elle mesaj yazıp göndermek zorunda kalmadan,
       kısa bir sessizlik sonrası seçimiyle sohbeti otomatik sürdür. */
    onChecklistToggle?.();
  };

  /* Seslendirme — Pollinations openai-audio (ücretsiz); hata olursa tarayıcı
     sesi. Yeni çağrı öncekini keser; ayrılırken (unmount) yalnız bu balonun
     başlattığı ses durdurulur. */
  const toggleSpeak = () => {
    if (speakingTts) { stopTts(); setSpeakingTts(false); return; }
    const text = speakableText(message.content);
    if (!text) return;
    setSpeakingTts(true);
    playTts(text, useStore.getState().config.ttsVoice || "nova", () => setSpeakingTts(false));
  };
  useEffect(() => () => { if (speakingRef.current) stopTts(); }, []);
  useEffect(() => { speakingRef.current = speakingTts; }, [speakingTts]);

  /* Düşünce panosu: dışarı tıklama / Escape ile kapanır (AuthButton'daki aynı desen). */
  useEffect(() => {
    if (!thinkingOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!thinkRef.current?.contains(e.target as Node)) setThinkingOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setThinkingOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [thinkingOpen]);

  const startEdit = () => {
    setEditText(message.content);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 50);
  };

  const submitEdit = () => {
    if (editText.trim() && onEdit) onEdit(index, editText.trim());
    setEditing(false);
  };

  const agent = message.agentId ? ALL_AGENTS.find((a) => a.id === message.agentId) : null;

  /* ── USER BUBBLE ─────────────────────────────────────────────────── */
  if (isUser) {
    /* Terminal çıktısı kullanıcı mesajları sohbette gösterilmez — çıktı zaten
       asistan mesajındaki "Terminal" todo kutusunda görünür (AI bağlamında kalır). */
    if (message.content.startsWith("**Terminal çıktısı**")) return null;
    /* L1 — analiz aracı çıktısı da aynı şekilde gizlenir: kod ve sonucu zaten
       asistan mesajındaki "Kod çalıştırma" kutusunda görünür (AI bağlamında kalır). */
    if (message.content.startsWith("**Kod çıktısı**")) return null;
    return (
      <div className={`group/msg flex justify-end py-3${enterCls}`}>
        {/* Klasik sohbet balonu — kullanıcı sağda, avatarsız (asistan solda
            avatarlı düz-metin akışı olarak kalır, bkz. aşağıdaki blok). */}
        <div className="max-w-[75%] min-w-0 flex flex-col items-end">
          {/* Images */}
          {message.images?.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={img}
              alt=""
              className="max-w-[260px] max-h-[200px] object-contain rounded-2xl border border-line/60 shadow-sm"
            />
          ))}

          {editing ? (
            <div className="flex flex-col gap-2 w-full">
              <textarea
                ref={taRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-surface border border-line rounded-2xl p-3 text-sm resize-none outline-none focus:border-brand/50 min-h-[60px]"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-line text-muted hover:text-ink transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={submitEdit}
                  className="text-xs px-3.5 py-1.5 rounded-xl bg-brand text-[#111110] font-semibold hover:bg-branddim transition-colors"
                >
                  Gönder
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group/bubble">
              <div className="user-bubble px-3.5 py-2.5 rounded-xl text-[15px] leading-relaxed whitespace-pre-wrap">
                {message.content}
              </div>
              {/* Hover actions */}
              <div className="flex items-center gap-0.5 mt-1.5 justify-end [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 transition-opacity duration-150">
                <button onClick={copyMessage} aria-label="Kopyala" className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                {onEdit && (
                  <button onClick={startEdit} aria-label="Düzenle" className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors">
                    <Pencil size={12} />
                  </button>
                )}
                {onSwitchVersion && message.branches && message.branches.length > 1 && (
                  <div className="flex items-center gap-0.5 text-[11px] text-muted/50">
                    <button
                      onClick={() => onSwitchVersion(Math.max(0, (message.branchIndex ?? 0) - 1))}
                      disabled={(message.branchIndex ?? 0) === 0}
                      aria-label="Önceki sürüm"
                      className="p-1.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="font-mono tabular-nums text-[10px]">
                      {(message.branchIndex ?? 0) + 1}/{message.branches.length}
                    </span>
                    <button
                      onClick={() => onSwitchVersion(Math.min(message.branches!.length - 1, (message.branchIndex ?? 0) + 1))}
                      disabled={(message.branchIndex ?? 0) === message.branches.length - 1}
                      aria-label="Sonraki sürüm"
                      className="p-1.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── ASSISTANT BUBBLE ────────────────────────────────────────────── */
  return (
    <div className={`group/msg flex gap-3 py-3${enterCls}`}>
      {/* Avatar — bu mesaj akarken hafif bir halka parıltısı alır (transient). */}
      <div className={`shrink-0 w-7 h-7 rounded-full bg-bgsoft border border-brand/20 grid place-items-center text-brand mt-0.5 shadow-sm${streamingNow ? " animate-stream-glow" : ""}`}>
        <Sparkles size={14} />
      </div>

      <div className="flex-1 min-w-0 pt-0.5">

        {/* Agent badge */}
        {agent && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-brand/10 border border-brand/20 text-brand/80 font-mono">
              <span>{agent.icon}</span>
              <span className="font-semibold">{agent.label}</span>
            </span>
          </div>
        )}

        {/* Kalite turu (fusion) rozeti — hangi taslak modellerinin birleştirildiğini gösterir */}
        {message.fusionModels && message.fusionModels.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-brand/10 border border-brand/20 text-brand/80 font-mono"
              title={`Taslaklar: ${message.fusionModels.join(", ")}`}
            >
              <Sparkles size={11} />
              <span className="font-semibold">Fusion · {message.fusionModels.length} model</span>
            </span>
          </div>
        )}

        {/* Ajan Ekibi (Swarm) ilerleme */}
        {message.swarm && <SwarmPanel swarm={message.swarm} />}

        {/* Terminal komutları (todo kutusu) */}
        {message.commands && message.commands.length > 0 && <CommandPanel commands={message.commands} />}

        {/* Görevler */}
        {message.plan && <PlanPanel plan={message.plan} streaming={streamingNow} />}

        {/* Web arama kaynakları */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-line/40 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/45 mb-1.5">Kaynaklar</div>
            <div className="space-y-1">
              {message.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-[11px] text-muted hover:text-brand transition-colors">
                  <span className="text-muted/40 font-mono shrink-0">{i + 1}.</span>
                  <span className="truncate">{s.title || s.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Thinking — akışta açık durmaz; "•••" tetikleyici camsı bir pano açar */}
        {message.thinking && (
          <div ref={thinkRef} className="relative inline-block mb-3">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              aria-expanded={thinkingOpen}
              aria-label="Düşünce sürecini göster"
              title="Düşünce süreci"
              className="relative grid h-[22px] w-[30px] place-items-center rounded-md border border-line bg-surface text-muted/60 transition-colors hover:text-brand hover:border-brand/40"
            >
              <MoreHorizontal size={13} />
              {streamingNow && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
            </button>
            {thinkingOpen && (
              <div className="animate-fade-in absolute left-0 top-[calc(100%+8px)] z-20 w-80 max-w-[85vw] rounded-2xl border border-line bg-surface/70 p-4 shadow-2xl backdrop-blur-xl backdrop-saturate-150">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-muted/60">
                  <Brain size={11} className="text-brand/70" /> Düşünce süreci
                </div>
                <div className="max-h-56 overflow-y-auto text-[12.5px] text-muted whitespace-pre-wrap leading-relaxed">
                  {message.thinking}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tool calls — update_plan hariç: o zaten yukarıdaki Görevler panelinde
           tam olarak gösteriliyor, burada ikinci kez "Plan güncellendi" satırı
           olarak tekrar etmesin. */}
        {(() => {
          const visibleCalls = message.toolCalls?.filter((c) => c.name !== "update_plan");
          return visibleCalls?.length ? <ToolCallGroup calls={visibleCalls} checkpoints={message.checkpoints} /> : null;
        })()}

        {/* Images */}
        {message.images?.map((img, i) => (
          <GeneratedImage key={`${i}-${img}`} src={img} />
        ))}

        {/* Karşılaştırma sütunları — normal içerik yerine gösterilir. */}
        {message.compareResults && message.compareResults.length > 0 && (
          <CompareColumns results={message.compareResults} onPick={onPickCompare} />
        )}

        {/* Content */}
        {message.compareResults && message.compareResults.length > 0 ? null : message.content ? (
          <div className={message.isError ? "rounded-xl border border-red/20 bg-red/5 px-3 py-2.5" : undefined}>
            {message.isError && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red mb-1.5">
                <AlertCircle size={12} /> Hata
              </div>
            )}
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkSplitFileLang]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                  pre: CodeBlock,
                  /* generate_image ARACI çağrıldıktan sonra model kendi metnine
                     '![prompt](url)' markdown'ı gömer — bu ReactMarkdown'ın ÇIPLAK
                     <img>'ına düşüyordu: Pollinations URL'i İSTEK ANINDA (ilk fetch'te)
                     üretir, yani görsel birkaç saniye sürebilir; çıplak <img> bu süre
                     boyunca hiçbir gösterge vermeden boş/kırık ikon gösteriyordu
                     ("kozmetik olarak kötü" — kullanıcı raporu). Aynı üretimin ESKİ
                     (/gorsel komut) yolu için zaten var olan, kanıtlanmış GeneratedImage
                     (shimmer + nefes alan Sparkles + yumuşak geçiş + oto-yeniden-dene)
                     bileşenini burada da kullan — iki yol da artık aynı animasyona sahip. */
                  img: function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
                    if (typeof src !== "string" || !src) return null;
                    return <GeneratedImage src={src} alt={alt} />;
                  },
                  /* Geniş tablolar taşmasın — yatay kaydırmalı sarmalayıcı. */
                  table: (props) => (
                    <div className="table-wrap">
                      <table {...props} />
                    </div>
                  ),
                  /* `<li>` düğümünün konumu güvenilir (mdast/hast position
                     korunuyor) — react-markdown'ın sentezlediği alt `<input>`
                     düğümünde ise HER ZAMAN undefined (doğrulandı). Satır
                     numarasını burada Context ile alt checkbox'a taşıyoruz;
                     mutasyona uğrayan bir sayaç (React Strict Mode'da render
                     iki kez çağrıldığından güvenilmez sonuç verir) KULLANMIYORUZ. */
                  li: function ChecklistLi({ node, children, ...rest }) {
                    return (
                      <ChecklistLineContext.Provider value={node?.position?.start?.line}>
                        <li {...rest}>{children}</li>
                      </ChecklistLineContext.Provider>
                    );
                  },
                  /* GFM işaretleme kutuları varsayılan olarak disabled gelir —
                     burada gerçek, tıklanabilir bir kutuya çeviriyoruz. Çıplak
                     native checkbox (yalnız accent-brand) uygulamanın geri
                     kalanındaki özel tasarımlı kontrollerin (McpGallery
                     anahtarı, TaskPanel'in CircleCheck'i vb.) yanında "cansız
                     ve garip" duruyordu — burada aynı dolgu+onay-ikonu
                     dilini kullanan özel bir kutuya sarıyoruz. */
                  input: function ChecklistInput({ node, ...rest }) {
                    void node; // rest.type ile ayrım yapılır; DOM'a sızmasın diye ayrıştırıldı
                    const line = useContext(ChecklistLineContext);
                    if (rest.type !== "checkbox") return <input {...rest} />;
                    const checked = !!rest.checked;
                    return (
                      <label className="inline-flex align-middle -mb-0.5 mr-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={streamingNow}
                          onChange={() => toggleContentCheckbox(line)}
                          className="sr-only"
                        />
                        <span
                          className={`w-[15px] h-[15px] shrink-0 rounded-[5px] border grid place-items-center transition-colors ${
                            checked ? "bg-brand border-brand" : "border-line hover:border-brand/50"
                          } ${streamingNow ? "opacity-50" : ""}`}
                        >
                          {checked && <Check size={10} className="text-[#111110]" strokeWidth={3.5} />}
                        </span>
                      </label>
                    );
                  },
                }}
              >
                {/* Model, kullanıcının yapıştırdığı token'ı yanıtında olduğu
                    gibi tekrar yazabiliyor (canlı örnek: güvenlik uyarısı
                    verirken token'ın tamamını ekrana bastı). GÖSTERİMDE
                    maskele — saklanan içerik değişmez, yalnız ekranda ve
                    dışa aktarmada sır görünmez. Kullanıcının KENDİ mesajı
                    bilinçli olarak maskelenmez (kendi yazdığını görebilmeli). */}
                {redactSecrets(message.content)}
              </ReactMarkdown>
              {streamingNow && <span className="caret" />}
            </div>
            {message.isError && showRegenerate && onRegenerate && (
              <button
                /* Sarmalayıcı şart: onRegenerate artık opsiyonel modelId alıyor,
                   doğrudan bağlanırsa MouseEvent modelId sanılırdı (N2). */
                onClick={() => onRegenerate()}
                className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red/10 text-red hover:bg-red/20 font-semibold text-xs transition-colors"
              >
                <RefreshCw size={11} /> Tekrar dene
              </button>
            )}
          </div>
        ) : streamingNow && !message.toolCalls?.length ? (
          /* S3 — "Yazıyor" göstergesi. Eskiden içerik yokken ya üç sönük nokta
             ya da düz bir "Düşünüyor…" vardı; hangi aşamada olunduğu
             görünmediği için bekleme ölü zaman gibi hissettiriyordu. Artık
             marka renginde akan bir parıltı şeridi + aşama metni. Aşama
             gerçekten bilinen sinyalden türetilir, uydurulmaz: "•••" panosunda
             içerik varsa (Füzyon durumu / gerçek reasoning) düşünme, yoksa
             yanıt bekleniyor demektir. */
          <span
            className="inline-flex items-center gap-2 py-1 text-[12.5px] text-muted/60"
            aria-live="polite"
            aria-label={message.thinking ? "Düşünüyor" : "Yanıt bekleniyor"}
          >
            {message.thinking
              ? <Brain size={13} className="text-brand/70 animate-breathe" />
              : <Sparkles size={12} className="text-brand/60 animate-breathe" />}
            <span>{message.thinking ? "Düşünüyor…" : "Yanıt hazırlanıyor…"}</span>
            <span className="typing-shimmer" aria-hidden />
          </span>
        ) : streamingNow ? (
          <span className="caret" />
        ) : null}

        {/* Token limit cut-off strip */}
        {!streamingNow && message.finishReason === "length" && onContinue && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow/20 bg-yellow/5 text-xs animate-fade-in">
            <ChevronRight size={12} className="text-yellow/70 shrink-0" />
            <span className="text-muted/60 flex-1 min-w-0">Yanıt token sınırında kesildi.</span>
            <button
              onClick={onContinue}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow/10 text-yellow hover:bg-yellow/20 font-semibold transition-colors shrink-0"
            >
              <ChevronRight size={11} /> Devam et
            </button>
          </div>
        )}

        {/* Action row */}
        {message.content && (
          <div className="flex items-center gap-0.5 mt-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 transition-opacity duration-150">
            <button onClick={copyMessage} aria-label={copied ? "Kopyalandı" : "Kopyala"} title={copied ? "Kopyalandı" : "Kopyala"} className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <button onClick={toggleSpeak} aria-label={speakingTts ? "Durdur" : "Seslendir"} title={speakingTts ? "Durdur" : "Yanıtı seslendir (Pollinations)"} className={`flex items-center gap-1 text-[11px] p-2.5 rounded-lg hover:bg-bgsoft transition-colors ${speakingTts ? "text-brand" : "text-muted/50 hover:text-ink"}`}>
              {speakingTts ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            {showRegenerate && onRegenerate && (
              /* N2 — tek model varsa doğrudan yeniden üretir (eski davranış);
                 birden çok model eklenmişse tıklayınca model listesi açılır ve
                 kullanıcı "aynı modelle" ya da başka bir modelle deneyebilir. */
              <div className="relative">
                <button
                  onClick={() => { if (otherModels.length === 0) onRegenerate(); else setRegenOpen((o) => !o); }}
                  aria-label="Yeniden oluştur"
                  aria-haspopup={otherModels.length > 0 ? "menu" : undefined}
                  aria-expanded={otherModels.length > 0 ? regenOpen : undefined}
                  title={otherModels.length > 0 ? "Yeniden oluştur — model seç" : "Yeniden oluştur"}
                  className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors"
                >
                  <RefreshCw size={12} />
                </button>
                {regenOpen && otherModels.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRegenOpen(false)} aria-hidden />
                    <div role="menu" className="absolute left-0 bottom-full mb-1 z-50 min-w-[190px] max-w-[260px] max-h-64 overflow-auto rounded-xl border border-line bg-surface shadow-xl py-1">
                      <button
                        role="menuitem"
                        onClick={() => { setRegenOpen(false); onRegenerate(); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-bgsoft transition-colors"
                      >Aynı modelle</button>
                      <div className="my-1 border-t border-line/60" />
                      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted/60">Başka modelle</div>
                      {otherModels.map((m) => (
                        <button
                          key={m.id}
                          role="menuitem"
                          onClick={() => { setRegenOpen(false); onRegenerate(m.id); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-bgsoft transition-colors truncate"
                          title={m.model}
                        >{m.label}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {onPostToPr && (
              <button onClick={onPostToPr} aria-label="PR/MR'a yorum olarak gönder" title="PR/MR'a yorum olarak gönder" className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors">
                <GitPullRequest size={12} />
              </button>
            )}
            {onSwitchVersion && message.branches && message.branches.length > 1 && (
              <div className="flex items-center gap-0.5 text-[11px] text-muted/50">
                <button
                  onClick={() => onSwitchVersion(Math.max(0, (message.branchIndex ?? 0) - 1))}
                  disabled={(message.branchIndex ?? 0) === 0}
                  aria-label="Önceki yanıt"
                  title="Önceki yanıt"
                  className="p-1.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="font-mono tabular-nums text-[10px]">
                  {(message.branchIndex ?? 0) + 1}/{message.branches.length}
                </span>
                <button
                  onClick={() => onSwitchVersion(Math.min(message.branches!.length - 1, (message.branchIndex ?? 0) + 1))}
                  disabled={(message.branchIndex ?? 0) === message.branches.length - 1}
                  aria-label="Sonraki yanıt"
                  title="Sonraki yanıt"
                  className="p-1.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}

            {chatId && (
              <>
                <div className="w-px h-3 bg-line/50 mx-0.5" />
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "up" ? null : "up")}
                  className={`p-2.5 rounded-lg transition-colors ${message.rating === "up" ? "text-green bg-green/10" : "text-muted/40 hover:text-green hover:bg-bgsoft"}`}
                  aria-label="Beğen"
                  title="Beğen"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "down" ? null : "down")}
                  className={`p-2.5 rounded-lg transition-colors ${message.rating === "down" ? "text-red bg-red/10" : "text-muted/40 hover:text-red hover:bg-bgsoft"}`}
                  aria-label="Beğenme"
                  title="Beğenme"
                >
                  <ThumbsDown size={12} />
                </button>
                <div className="w-px h-3 bg-line/50 mx-0.5" />
                <button
                  onClick={openSkillSave}
                  className="flex items-center gap-1 text-[11px] text-muted/40 hover:text-brand hover:bg-bgsoft p-2.5 rounded-lg transition-colors"
                  aria-label="Skill olarak kaydet"
                  title="Skill olarak kaydet"
                >
                  <BookMarked size={12} />
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveHighlight(); }}
                  className="flex items-center gap-1 text-[11px] text-muted/40 hover:text-yellow hover:bg-bgsoft p-2.5 rounded-lg transition-colors"
                  aria-label="Vurgula (seçili metni ya da yanıt başını kaydet)"
                  title="Vurgula — seçili metni kaydet (Kartlar → Vurgular)"
                >
                  <Highlighter size={12} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Ö4 — model bir SKILL.md ÜRETTİYSE (--- frontmatter + name:) bunu
            TANI ve kaydetmeyi öner. Kullanıcının isteği "skill yaptırdığımda
            … skills kısmına kaydedebilmek"ti; eskiden kaydetme eylemi diğer
            ikonların arasında kayboluyordu, üretilen skill fark edilmiyordu.

            Modelin KENDİ KENDİNE kaydetmesi (otomatik bir save_skill aracı)
            bilerek YAPILMADI: kalıcı kullanıcı verisine onaysız yazmak bu
            kod tabanındaki yazma-onayı desenine aykırı olurdu. Tek tık
            uzaklıkta ama karar kullanıcının. */}
        {!streamingNow && message.role === "assistant" && !skillSaveOpen && looksLikeSkillMd(message.content) && (
          <button
            onClick={openSkillSave}
            className="mt-3 w-full flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-[11px] text-brand/90 hover:bg-brand/10 transition-colors text-left"
          >
            <BookMarked size={12} className="shrink-0" />
            <span className="flex-1">Bu bir <b>SKILL.md</b> — Skills&apos;e kaydet</span>
          </button>
        )}

        {/* Skill save mini-form */}
        {skillSaveOpen && (
          <div className="mt-3 border border-brand/20 bg-brand/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-brand/80 flex items-center gap-1.5">
                <BookMarked size={11} /> Skill olarak kaydet
              </span>
              <button onClick={() => setSkillSaveOpen(false)} className="text-muted/50 hover:text-ink transition-colors">
                <X size={12} />
              </button>
            </div>
            <input
              value={skillTitle}
              onChange={(e) => setSkillTitle(e.target.value)}
              placeholder="Skill başlığı…"
              className="w-full bg-bgsoft border border-line/60 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-brand/50"
              onKeyDown={(e) => { if (e.key === "Enter") saveSkill(); if (e.key === "Escape") setSkillSaveOpen(false); }}
              autoFocus
            />
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              rows={3}
              className="w-full bg-bgsoft border border-line/60 rounded-lg px-2.5 py-1.5 text-[11px] font-mono outline-none focus:border-brand/50 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSkillSaveOpen(false)} className="text-[11px] px-2.5 py-1 rounded-lg border border-line text-muted hover:text-ink transition-colors">
                İptal
              </button>
              <button
                onClick={saveSkill}
                disabled={!skillTitle.trim()}
                className="text-[11px] px-3 py-1 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim disabled:opacity-40 transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Performans: store streaming sırasında yalnız SON mesaj nesnesini değiştirir
   (diğerlerinin referansı sabit kalır). Bu yüzden mesaj referansı + ilgili skaler
   prop'lar değişmedikçe yeniden render etme — her token'da tüm sohbetin markdown +
   syntax-highlight yeniden parse edilmesini önler (uzun sohbetlerde belirgin
   akıcılık). Fonksiyon prop'ları davranışsal olarak sabittir (argümanlarını açıkça
   alır), o yüzden kimlik karşılaştırması yapılmaz. */
export const MessageBubble = memo(MessageBubbleImpl, (prev, next) =>
  prev.message === next.message &&
  prev.index === next.index &&
  prev.chatId === next.chatId &&
  prev.showRegenerate === next.showRegenerate &&
  prev.streamingNow === next.streamingNow &&
  !!prev.onContinue === !!next.onContinue &&
  !!prev.onEdit === !!next.onEdit &&
  !!prev.onSwitchVersion === !!next.onSwitchVersion &&
  !!prev.onChecklistToggle === !!next.onChecklistToggle &&
  !!prev.onPostToPr === !!next.onPostToPr,
);
