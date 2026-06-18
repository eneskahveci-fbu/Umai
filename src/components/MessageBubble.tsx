"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  BookMarked, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleDot, ListChecks,
  Code2, Copy, FileText, FolderOpen, GitBranch, GitCommit, Globe,
  Loader2, Pencil, RefreshCw, Search, Terminal as TerminalIcon, ThumbsDown, ThumbsUp, User, Users, Wrench, X,
} from "lucide-react";
import type { ChatMessage, SwarmState } from "@/lib/types";
import { useStore } from "@/lib/store";
import { CodeBlock } from "./CodeBlock";
import { ALL_AGENTS } from "@/lib/agents";

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
                className="opacity-0 group-hover/tool:opacity-100 transition-opacity flex items-center gap-0.5 text-[10px] text-muted/40 hover:text-muted/70 px-1 py-0.5 rounded"
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
              <Check size={12} className="text-green shrink-0 mt-0.5" />
            ) : s.status === "active" ? (
              <CircleDot size={12} className="text-brand shrink-0 mt-0.5 animate-pulse" />
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

const SWARM_ROLE_ICON: Record<string, string> = {
  mimar: "📐",
  kodlayıcı: "⌨️",
  test: "🧪",
  inceleyici: "🔍",
  araştırmacı: "🔬",
  genel: "⚙️",
};

const SWARM_PHASE_LABEL: Record<SwarmState["phase"], string> = {
  planning: "Görevler planlanıyor…",
  working: "Ajanlar çalışıyor…",
  synthesizing: "Sonuçlar birleştiriliyor…",
  done: "Ajan ekibi tamamlandı",
};

function SwarmPanel({ swarm }: { swarm: SwarmState }) {
  const { phase, agents } = swarm;
  const done = agents.filter((a) => a.status === "done").length;
  const active = phase !== "done";
  return (
    <div className="mb-3 border border-line/50 rounded-xl overflow-hidden bg-bgsoft/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/30 text-xs">
        <Users size={12} className={active ? "text-brand animate-pulse" : "text-green"} />
        <span className="font-semibold">Ajan Ekibi</span>
        <span className="text-muted/60">· {SWARM_PHASE_LABEL[phase]}</span>
        {agents.length > 0 && (
          <span className="text-muted/50 font-mono ml-auto tabular-nums">{done}/{agents.length}</span>
        )}
      </div>
      {phase === "planning" && agents.length === 0 ? (
        <div className="px-3 py-2.5 flex items-center gap-2 text-xs text-muted/70">
          <Loader2 size={12} className="animate-spin text-brand" />
          <span>Görevler belirleniyor…</span>
        </div>
      ) : (
        <div className="px-3 py-2.5 space-y-1.5">
          {agents.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5 w-4 text-center leading-none">
                {SWARM_ROLE_ICON[a.role] ?? "⚙️"}
              </span>
              {a.status === "done" ? (
                <Check size={12} className="text-green shrink-0 mt-0.5" />
              ) : a.status === "error" ? (
                <X size={12} className="text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Loader2 size={12} className="text-brand shrink-0 mt-0.5 animate-spin" />
              )}
              <span className={
                a.status === "done" ? "text-muted/60" :
                a.status === "error" ? "text-red-400/80" :
                "text-ink font-medium"
              }>
                {a.title}
              </span>
            </div>
          ))}
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
          <X size={12} className="text-red-400 shrink-0 mt-0.5" />
        ) : (
          <Check size={12} className="text-green shrink-0 mt-0.5" />
        )}
        <code className={`flex-1 min-w-0 font-mono break-all ${cmd.status === "running" ? "text-ink" : "text-muted/80"}`}>
          $ {cmd.command}
        </code>
        {hasOutput && (open ? <ChevronUp size={12} className="text-muted/40 shrink-0 mt-0.5" /> : <ChevronDown size={12} className="text-muted/40 shrink-0 mt-0.5" />)}
      </button>
      {hasOutput && open && (
        <pre className="mt-1 ml-5 px-2.5 py-1.5 rounded-lg bg-[#0a0a0d] border border-line/40 text-[11px] font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto text-muted/80">
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

/* ── MessageBubble ─────────────────────────────────────────────────── */

export function MessageBubble({
  message,
  index,
  chatId,
  showRegenerate,
  onRegenerate,
  onContinue,
  onEdit,
  onSwitchVersion,
  streamingNow,
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
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  /* Düşünme süreci varsayılan AÇIK: üretim sürerken otomatik genişler ki
     kullanıcı modelin gerçek zamanlı düşünmesini görsün. */
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rateMessage = useStore((s) => s.rateMessage);
  const addSkill = useStore((s) => s.addSkill);
  const addToast = useStore((s) => s.addToast);
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

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* yoksay */ }
  };

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
      <div className="group/msg flex gap-3 py-3 animate-fade-in">
        {/* Kullanıcı avatarı — solda, asistan ✦ ile simetrik (Claude Code'dan
            uyarlanan düz transkript düzeni; craft teması/avatarı korunur). */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-bgsoft border border-line grid place-items-center text-muted mt-0.5 shadow-sm">
          <User size={14} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
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
              <div className="flex gap-2 justify-start">
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
              <div className="flex items-center gap-0.5 mt-1.5 justify-start [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 transition-opacity duration-150">
                <button onClick={copyMessage} className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft transition-colors">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
                {onEdit && (
                  <button onClick={startEdit} className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft transition-colors">
                    <Pencil size={11} />
                  </button>
                )}
                {onSwitchVersion && message.branches && message.branches.length > 1 && (
                  <div className="flex items-center gap-0.5 text-[11px] text-muted/50">
                    <button
                      onClick={() => onSwitchVersion(Math.max(0, (message.branchIndex ?? 0) - 1))}
                      disabled={(message.branchIndex ?? 0) === 0}
                      className="p-0.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="font-mono tabular-nums text-[10px]">
                      {(message.branchIndex ?? 0) + 1}/{message.branches.length}
                    </span>
                    <button
                      onClick={() => onSwitchVersion(Math.min(message.branches!.length - 1, (message.branchIndex ?? 0) + 1))}
                      disabled={(message.branchIndex ?? 0) === message.branches.length - 1}
                      className="p-0.5 rounded hover:bg-bgsoft disabled:opacity-30 transition-colors"
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
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-bgsoft border border-brand/20 grid place-items-center text-brand text-sm mt-0.5 shadow-sm">
        ✦
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

        {/* Ajan Ekibi (Swarm) ilerleme */}
        {message.swarm && <SwarmPanel swarm={message.swarm} />}

        {/* Terminal komutları (todo kutusu) */}
        {message.commands && message.commands.length > 0 && <CommandPanel commands={message.commands} />}

        {/* Plan */}
        {message.plan && <PlanPanel plan={message.plan} />}

        {/* Thinking */}
        {message.thinking && (
          <div className="mb-3 border border-brand/15 rounded-xl overflow-hidden bg-brand/5">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand/70 hover:text-brand/90 transition-colors"
            >
              <Brain size={12} />
              <span className="font-semibold">Düşünce süreci</span>
              {thinkingOpen
                ? <ChevronDown size={11} className="ml-auto opacity-60" />
                : <ChevronRight size={11} className="ml-auto opacity-60" />}
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3 text-[11px] text-muted/60 font-mono whitespace-pre-wrap leading-relaxed border-t border-brand/10 pt-2">
                {message.thinking}
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={img}
            alt=""
            className="max-w-[320px] max-h-[220px] object-contain rounded-xl border border-line mb-3"
          />
        ))}

        {/* Content */}
        {message.content ? (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{ pre: CodeBlock }}
            >
              {message.content}
            </ReactMarkdown>
            {streamingNow && <span className="caret" />}
          </div>
        ) : streamingNow && !message.thinking && !message.toolCalls?.length ? (
          <span className="inline-flex items-center gap-1 py-1 text-muted/50" aria-label="Yazıyor">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
          </span>
        ) : (
          <span className="caret" />
        )}

        {/* Token limit cut-off strip */}
        {!streamingNow && message.finishReason === "length" && onContinue && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-400/20 bg-amber-400/5 text-xs animate-fade-in">
            <ChevronRight size={12} className="text-amber-400/70 shrink-0" />
            <span className="text-muted/60 flex-1 min-w-0">Yanıt token sınırında kesildi.</span>
            <button
              onClick={onContinue}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 font-semibold transition-colors shrink-0"
            >
              <ChevronRight size={11} /> Devam et
            </button>
          </div>
        )}

        {/* Action row */}
        {message.content && (
          <div className="flex items-center gap-0.5 mt-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 transition-opacity duration-150">
            <button onClick={copyMessage} className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink px-2 py-1.5 rounded-lg hover:bg-bgsoft transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
            </button>
            {showRegenerate && onRegenerate && (
              <button onClick={onRegenerate} className="flex items-center gap-1 text-[11px] text-muted/50 hover:text-ink px-2 py-1.5 rounded-lg hover:bg-bgsoft transition-colors">
                <RefreshCw size={12} /><span>Yeniden</span>
              </button>
            )}

            {chatId && (
              <>
                <div className="w-px h-3 bg-line/50 mx-0.5" />
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "up" ? null : "up")}
                  className={`p-1.5 rounded-lg transition-colors ${message.rating === "up" ? "text-green bg-green/10" : "text-muted/40 hover:text-green hover:bg-bgsoft"}`}
                  title="Beğen"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "down" ? null : "down")}
                  className={`p-1.5 rounded-lg transition-colors ${message.rating === "down" ? "text-red bg-red/10" : "text-muted/40 hover:text-red hover:bg-bgsoft"}`}
                  title="Beğenme"
                >
                  <ThumbsDown size={12} />
                </button>
                <div className="w-px h-3 bg-line/50 mx-0.5" />
                <button
                  onClick={openSkillSave}
                  className="flex items-center gap-1 text-[11px] text-muted/40 hover:text-brand hover:bg-bgsoft px-2 py-1.5 rounded-lg transition-colors"
                  title="Skill olarak kaydet"
                >
                  <BookMarked size={12} />
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
