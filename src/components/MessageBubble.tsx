"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  BookMarked, Brain, Check, ChevronDown, ChevronRight, ChevronUp,
  Code2, Copy, FileText, FolderOpen, GitBranch, GitCommit, Globe,
  Loader2, Pencil, RefreshCw, Search, ThumbsDown, ThumbsUp, Wrench, X,
} from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { CodeBlock } from "./CodeBlock";
import { AGENTS } from "@/lib/agents";

/* ── Tool metadata ─────────────────────────────────────────────────── */

const TOOL_LABEL: Record<string, string> = {
  read_file:          "Dosya okunuyor",
  list_files:         "Dosyalar listeleniyor",
  search_files:       "Dosya yolu aranıyor",
  search_code:        "Kod içeriği aranıyor",
  write_file:         "Dosya yazılıyor",
  list_branches:      "Dallar listeleniyor",
  create_branch:      "Dal oluşturuluyor",
  get_commit_history: "Commit geçmişi alınıyor",
  web_search:         "Web'de aranıyor",
  read_url:           "Sayfa okunuyor",
};

const TOOL_DONE_LABEL: Record<string, string> = {
  read_file:          "Okundu",
  list_files:         "Listelendi",
  search_files:       "Arandı",
  search_code:        "Arandı",
  write_file:         "Yazıldı",
  list_branches:      "Listelendi",
  create_branch:      "Oluşturuldu",
  get_commit_history: "Alındı",
  web_search:         "Arandı",
  read_url:           "Okundu",
};

function ToolIcon({ name, size = 11 }: { name: string; size?: number }) {
  switch (name) {
    case "read_file":          return <FileText size={size} />;
    case "list_files":         return <FolderOpen size={size} />;
    case "search_files":       return <Search size={size} />;
    case "search_code":        return <Code2 size={size} />;
    case "write_file":         return <FileText size={size} className="text-green" />;
    case "list_branches":
    case "create_branch":      return <GitBranch size={size} />;
    case "get_commit_history": return <GitCommit size={size} />;
    case "web_search":
    case "read_url":           return <Globe size={size} />;
    default:                   return <Wrench size={size} />;
  }
}

function getKeyArg(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read_file":   return String(args.path ?? "");
    case "write_file":  return String(args.path ?? "");
    case "create_branch": return String(args.name ?? "");
    case "search_files":
    case "search_code": return `"${args.query}"${args.extension ? ` (.${args.extension})` : ""}`;
    case "web_search":  return `"${args.query}"`;
    case "read_url": {
      const u = String(args.url ?? "");
      try { return new URL(u).hostname; } catch { return u.slice(0, 50); }
    }
    case "list_files":  return args.filter ? `*${args.filter}*` : "";
    default: return "";
  }
}

function ToolCallCard({ call }: { call: NonNullable<ChatMessage["toolCalls"]>[number] }) {
  const [open, setOpen] = useState(false);
  const isRunning = call.status === "pending";
  const args = (() => { try { return JSON.parse(call.arguments || "{}"); } catch { return {}; } })();
  const label = isRunning ? (TOOL_LABEL[call.name] ?? call.name) : (TOOL_DONE_LABEL[call.name] ?? call.name);
  const keyArg = getKeyArg(call.name, args);

  return (
    <div>
      <div className="flex items-center gap-2 py-1 min-w-0 group/tool">
        <div className="shrink-0 w-4 flex justify-center">
          {isRunning
            ? <Loader2 size={10} className="animate-spin text-brand" />
            : <Check size={10} className="text-green/80" />}
        </div>
        <span className={`shrink-0 ${isRunning ? "text-brand" : "text-muted/50"}`}>
          <ToolIcon name={call.name} />
        </span>
        <span className={`text-[11px] font-medium shrink-0 ${isRunning ? "text-ink/80" : "text-muted/60"}`}>
          {label}
        </span>
        {keyArg && (
          <code className={`text-[11px] font-mono truncate min-w-0 ${isRunning ? "text-brand/80" : "text-muted/50"}`}>
            {keyArg}
          </code>
        )}
        {call.result && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="ml-auto shrink-0 opacity-0 group-hover/tool:opacity-100 transition-opacity flex items-center gap-0.5 text-[10px] text-muted/50 hover:text-muted px-1.5 py-0.5 rounded hover:bg-bgsoft"
          >
            {open ? <><ChevronUp size={9} /> gizle</> : <><ChevronDown size={9} /> sonuç</>}
          </button>
        )}
      </div>
      {open && call.result && (
        <div className="ml-6 mb-1 rounded-lg bg-bgsoft/40 border border-line/30 px-2.5 py-2">
          <pre className="font-mono text-[10px] text-muted/70 whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
            {call.result}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Tool call group ───────────────────────────────────────────────── */

function ToolCallGroup({ calls }: { calls: NonNullable<ChatMessage["toolCalls"]> }) {
  const running = calls.filter((c) => c.status === "pending");
  const done    = calls.filter((c) => c.status !== "pending");
  const [collapsed, setCollapsed] = useState(false);

  const headerText = running.length > 0
    ? `${running.length > 1 ? `${running.length} işlem` : "1 işlem"} çalışıyor…`
    : `${calls.length} işlem tamamlandı`;

  /* Count reads for cross-file summary */
  const readFiles = calls
    .filter((c) => c.name === "read_file")
    .map((c) => { try { return JSON.parse(c.arguments || "{}").path as string; } catch { return ""; } })
    .filter(Boolean);

  return (
    <div className="mb-3 border border-line/40 rounded-xl overflow-hidden">
      <button
        onClick={() => { if (running.length === 0) setCollapsed((v) => !v); }}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bgsoft/30 hover:bg-bgsoft/50 transition-colors text-left"
      >
        {running.length > 0
          ? <Loader2 size={10} className="animate-spin text-brand shrink-0" />
          : <Check size={10} className="text-green/80 shrink-0" />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/60 flex-1">{headerText}</span>
        {readFiles.length > 1 && running.length === 0 && (
          <span className="text-[10px] text-muted/40 mr-2">{readFiles.length} dosya çapraz okundu</span>
        )}
        {running.length === 0 && (
          collapsed ? <ChevronRight size={10} className="text-muted/40 shrink-0" /> : <ChevronDown size={10} className="text-muted/40 shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 py-1 divide-y divide-line/20">
          {calls.map((tc) => <ToolCallCard key={tc.id} call={tc} />)}
        </div>
      )}

      {/* Cross-file reading summary */}
      {!collapsed && readFiles.length > 1 && done.length === calls.length && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {readFiles.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue/8 text-blue/70 font-mono">
              <FileText size={9} /> {f.split("/").pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Action button ─────────────────────────────────────────────────── */

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] text-muted hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-bgsoft transition-colors"
    >
      {icon} {label}
    </button>
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
}: {
  message: ChatMessage;
  index: number;
  chatId?: string;
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onEdit?: (index: number, content: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [thinkingOpen, setThinkingOpen] = useState(false);
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

  const agent = message.agentId ? AGENTS.find((a) => a.id === message.agentId) : null;

  return (
    <div className="group/msg flex gap-3.5 py-5">
      <div
        className={`shrink-0 w-8 h-8 rounded-xl grid place-items-center text-sm font-bold shadow-sm ${
          isUser ? "bg-blue/90 text-white" : "bg-brand/10 border border-brand/25 text-brand"
        }`}
      >
        {isUser ? "S" : "✦"}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">

        {/* Agent + model badge row */}
        {!isUser && agent && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-brand/10 border border-brand/25 text-brand/90 font-mono">
              <span>{agent.icon}</span>
              <span className="font-semibold">{agent.label}</span>
            </span>
          </div>
        )}

        {/* Thinking block */}
        {message.thinking && (
          <div className="mb-3 border border-brand/20 rounded-xl overflow-hidden bg-brand/4">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand/80 hover:text-brand transition-colors"
            >
              <Brain size={12} />
              <span className="font-semibold">Düşünce süreci</span>
              {thinkingOpen ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3 text-[11px] text-muted/70 font-mono whitespace-pre-wrap leading-relaxed border-t border-brand/10 pt-2">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Tool call group — Claude Code style activity tracker */}
        {message.toolCalls?.length ? (
          <ToolCallGroup calls={message.toolCalls} />
        ) : null}

        {/* Images */}
        {message.images?.map((img, i) => (
          <img
            key={i}
            src={img}
            alt=""
            className="max-w-[320px] max-h-[220px] object-contain rounded-xl border border-line mb-3"
          />
        ))}

        {/* Content */}
        {isUser ? (
          editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={taRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-bgsoft border border-line rounded-xl p-3 text-sm resize-none outline-none focus:border-brand min-h-[60px]"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitEdit}
                  className="text-xs px-3.5 py-1.5 rounded-lg bg-brand text-[#111110] font-semibold hover:bg-branddim transition-colors"
                >
                  Gönder
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
              {message.content}
            </div>
          )
        ) : message.content ? (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{ pre: CodeBlock }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="caret" />
        )}

        {/* Action buttons */}
        {message.content && !editing && (
          <div className="flex items-center gap-0.5 mt-2.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 transition-opacity duration-200">
            <ActionBtn onClick={copyMessage} icon={copied ? <Check size={13} /> : <Copy size={13} />} label={copied ? "Kopyalandı" : "Kopyala"} />
            {isUser && onEdit && (
              <ActionBtn onClick={startEdit} icon={<Pencil size={13} />} label="Düzenle" />
            )}
            {showRegenerate && onRegenerate && (
              <ActionBtn onClick={onRegenerate} icon={<RefreshCw size={13} />} label="Yeniden" />
            )}
            {showRegenerate && onContinue && (
              <ActionBtn onClick={onContinue} icon={<ChevronRight size={13} />} label="Devam et" />
            )}
            {!isUser && chatId && (
              <>
                <div className="w-px h-3.5 bg-line/60 mx-0.5" />
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "up" ? null : "up")}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors ${message.rating === "up" ? "text-green-400 bg-green-400/10" : "text-muted hover:text-green-400 hover:bg-bgsoft"}`}
                  title="Beğen"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => rateMessage(chatId, index, message.rating === "down" ? null : "down")}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors ${message.rating === "down" ? "text-red/80 bg-red/10" : "text-muted hover:text-red/80 hover:bg-bgsoft"}`}
                  title="Beğenme"
                >
                  <ThumbsDown size={12} />
                </button>
                <div className="w-px h-3.5 bg-line/60 mx-0.5" />
                <button
                  onClick={openSkillSave}
                  className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors text-muted hover:text-brand hover:bg-bgsoft"
                  title="Skill olarak kaydet"
                >
                  <BookMarked size={12} />
                  <span>Skill</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Skill save mini-modal */}
        {skillSaveOpen && (
          <div className="mt-3 border border-brand/25 bg-brand/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-brand flex items-center gap-1.5">
                <BookMarked size={11} /> Skill olarak kaydet
              </span>
              <button onClick={() => setSkillSaveOpen(false)} className="text-muted hover:text-ink transition-colors">
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
