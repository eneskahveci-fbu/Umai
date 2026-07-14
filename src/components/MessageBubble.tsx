"use client";

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertCircle, BookMarked, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleCheck, Compass, FlaskConical, ImageOff, ListChecks, Microscope, MoreHorizontal, Settings2,
  Code2, Copy, FileText, FolderOpen, GitBranch, GitCommit, Globe,
  Highlighter, Loader2, Pencil, RefreshCw, Search, Sparkles, Terminal as TerminalIcon, ThumbsDown, ThumbsUp, Users, Volume2, VolumeX, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatMessage, SwarmState } from "@/lib/types";
import { useStore } from "@/lib/store";
import { CodeBlock } from "./CodeBlock";
import { ALL_AGENTS } from "@/lib/agents";
import { playTts, speakableText, stopTts } from "@/lib/pollinations";
import { toggleChecklistLine } from "@/lib/checklist";

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
  get_commit_history: "Alındı",
  web_search:         "Arandı",
  read_url:           "Okundu",
  dispatch_agents:    "Tamamlandı",
  update_plan:        "Plan güncellendi",
  create_pr:          "PR oluşturuldu",
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
    default: return "";
  }
}

function ToolCallCard({
  call,
  isLast,
}: {
  call: NonNullable<ChatMessage["toolCalls"]>[number];
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
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
              <span className="text-[10px] text-muted/30 font-mono tabular-nums">{elapsed}</span>
            )}
            {call.result && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tool:opacity-100 transition-opacity flex items-center gap-0.5 text-[10px] text-muted/40 hover:text-muted/70 px-1 py-0.5 rounded"
              >
                {open ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
            )}
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

/* ── Plan paneli (update_plan) ─────────────────────────────────────── */

function PlanPanel({ plan }: { plan: string }) {
  const steps = plan
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^\[([ x~\-])\]\s*(.*)$/.exec(l);
      if (!m) return { status: "pending" as const, text: l.replace(/^[-*]\s*/, "") };
      const c = m[1];
      const status = c === "x" ? ("done" as const) : c === "~" || c === "-" ? ("active" as const) : ("pending" as const);
      return { status, text: m[2] };
    });
  if (!steps.length) return null;
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs">
        <ListChecks size={12} className="text-brand" />
        <span className="font-semibold">Plan</span>
        <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{steps.length}</span>
      </div>
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
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs">
        <TerminalIcon size={12} className={running ? "text-brand animate-pulse" : "text-green"} />
        <span className="font-semibold">Terminal</span>
        <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{commands.length}</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        {commands.map((c, i) => <CommandRow key={i} cmd={c} />)}
      </div>
    </div>
  );
}

/* ── Tool call group ───────────────────────────────────────────────── */

function ToolCallGroup({ calls }: { calls: NonNullable<ChatMessage["toolCalls"]> }) {
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
            <ToolCallCard key={tc.id} call={tc} isLast={i === calls.length - 1} />
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
   bu yüzden `<img>` yüklenmesi 5-40sn sürebilir ve bazen (aşırı yük/NSFW
   filtresi/zaman aşımı) başarısız olur. Eskiden çıplak bir <img> vardı:
   yavaşken hiçbir gösterge yoktu, başarısız olunca sessizce kayboluyordu.
   Artık: yüklenirken nabız atan shimmer iskelet, gelince yumuşak geçiş,
   başarısız olursa 2 kez sessizce otomatik yeniden dener, hâlâ olmazsa
   elle "Tekrar dene" gösterir. */
const IMAGE_AUTO_RETRY_DELAYS_MS = [1500, 3000];

/* `key`'i çağıran tarafta `src`'e bağlayarak (bkz. kullanım yeri) prompt
   değişince bileşen tamamen yeniden monte olur — durumu sıfırlamak için
   ayrı bir "prop değişince state resetle" effect'ine gerek kalmaz. */
function GeneratedImage({ src, alt }: { src: string; alt?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [bust, setBust] = useState(0);
  const autoRetriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); }, []);

  const handleError = () => {
    if (autoRetriesRef.current < IMAGE_AUTO_RETRY_DELAYS_MS.length) {
      const delay = IMAGE_AUTO_RETRY_DELAYS_MS[autoRetriesRef.current];
      autoRetriesRef.current += 1;
      retryTimerRef.current = setTimeout(() => setBust((b) => b + 1), delay);
    } else {
      setStatus("error");
    }
  };

  const retryManually = () => {
    autoRetriesRef.current = 0;
    setStatus("loading");
    setBust((b) => b + 1);
  };

  const loadSrc = bust === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}_r=${bust}`;

  return (
    <div className="relative w-full max-w-[280px] aspect-square overflow-hidden rounded-xl border border-line bg-surface mb-3">
      {status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={bust}
          src={loadSrc}
          alt={alt ?? ""}
          onLoad={() => setStatus("loaded")}
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
}: {
  message: ChatMessage;
  index: number;
  chatId?: string;
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onEdit?: (index: number, content: string) => void;
  onSwitchVersion?: (branchIndex: number) => void;
  streamingNow?: boolean;
  onChecklistToggle?: () => void;
}) {
  const isUser = message.role === "user";
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
  const [skillSaveOpen, setSkillSaveOpen] = useState(false);
  const [skillTitle, setSkillTitle] = useState("");
  const [skillContent, setSkillContent] = useState("");

  const openSkillSave = () => {
    const firstLine = message.content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 72);
    setSkillTitle(firstLine || "AI Yanıtı");
    setSkillContent(message.content.slice(0, 4000));
    setSkillSaveOpen(true);
  };

  const saveSkill = () => {
    if (!skillTitle.trim()) return;
    addSkill({ title: skillTitle.trim(), content: skillContent, tags: [], enabled: true, source: "manual" });
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
    return (
      <div className="group/msg flex justify-end py-3 animate-fade-in">
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
    <div className="group/msg flex gap-3 py-3 animate-fade-in">
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

        {/* Plan */}
        {message.plan && <PlanPanel plan={message.plan} />}

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

        {/* Tool calls */}
        {message.toolCalls?.length ? (
          <ToolCallGroup calls={message.toolCalls} />
        ) : null}

        {/* Images */}
        {message.images?.map((img, i) => (
          <GeneratedImage key={`${i}-${img}`} src={img} />
        ))}

        {/* Content */}
        {message.content ? (
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
                {message.content}
              </ReactMarkdown>
              {streamingNow && <span className="caret" />}
            </div>
            {message.isError && showRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red/10 text-red hover:bg-red/20 font-semibold text-xs transition-colors"
              >
                <RefreshCw size={11} /> Tekrar dene
              </button>
            )}
          </div>
        ) : streamingNow && !message.thinking && !message.toolCalls?.length ? (
          <span className="inline-flex items-center gap-1.5 py-1 text-muted/50" aria-label="Yazıyor">
            <span className="typing-dot" />
            <span className="typing-dot delay-1" />
            <span className="typing-dot delay-2" />
          </span>
        ) : (
          <span className="caret" />
        )}

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
              <button onClick={onRegenerate} aria-label="Yeniden oluştur" title="Yeniden oluştur" className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink p-2.5 rounded-lg hover:bg-bgsoft transition-colors">
                <RefreshCw size={12} />
              </button>
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
  !!prev.onChecklistToggle === !!next.onChecklistToggle,
);
