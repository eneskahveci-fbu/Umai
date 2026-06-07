"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Brain, Check, ChevronDown, ChevronRight, Copy, Loader2, Pencil, RefreshCw, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { CodeBlock } from "./CodeBlock";
import { AGENTS } from "@/lib/agents";

function ToolCallCard({ call }: { call: NonNullable<ChatMessage["toolCalls"]>[number] }) {
  const [open, setOpen] = useState(false);
  let argsPreview = "";
  try {
    const args = JSON.parse(call.arguments || "{}");
    argsPreview = Object.values(args).filter(Boolean).join(", ");
  } catch { argsPreview = call.arguments?.slice(0, 60) ?? ""; }

  const isRunning = call.status === "pending";

  return (
    <div className="border border-line/60 bg-bgsoft/30 rounded-xl text-xs overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/60 transition-colors text-left"
      >
        {open ? <ChevronDown size={11} className="text-muted/50 shrink-0" /> : <ChevronRight size={11} className="text-muted/50 shrink-0" />}
        {isRunning ? <Loader2 size={11} className="animate-spin text-brand shrink-0" /> : <Wrench size={11} className="text-brand/70 shrink-0" />}
        <code className="font-mono font-semibold text-brand/90 shrink-0">{call.name}</code>
        {argsPreview && (
          <span className="text-muted/60 truncate text-[11px] font-mono">({argsPreview})</span>
        )}
        {isRunning && <span className="text-[10px] text-muted/50 ml-auto shrink-0">çalışıyor…</span>}
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 py-2 bg-[#0a0a0d]">
          <div className="text-[10px] text-muted/40 uppercase font-bold mb-1">Sonuç</div>
          <pre className="font-mono text-[11px] text-muted/80 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {call.result ?? "(beklemede)"}
          </pre>
        </div>
      )}
    </div>
  );
}

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

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* yoksay */
    }
  };

  const startEdit = () => {
    setEditText(message.content);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 50);
  };

  const submitEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(index, editText.trim());
    }
    setEditing(false);
  };

  return (
    <div className="group/msg flex gap-3.5 py-5">
      <div
        className={`shrink-0 w-8 h-8 rounded-xl grid place-items-center text-sm font-bold shadow-sm ${
          isUser ? "bg-blue/90 text-white" : "brand-gradient text-white"
        }`}
      >
        {isUser ? "S" : "✦"}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Agent rozeti */}
        {message.agentId && (() => {
          const agent = AGENTS.find((a) => a.id === message.agentId);
          if (!agent) return null;
          return (
            <div className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-brand/10 border border-brand/25 text-brand/90 font-mono mb-2">
              <span>{agent.icon}</span>
              <span>{agent.command}</span>
            </div>
          );
        })()}

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

        {/* Tool calls */}
        {message.toolCalls?.length ? (
          <div className="space-y-1 mb-3">
            {message.toolCalls.map((tc) => <ToolCallCard key={tc.id} call={tc} />)}
          </div>
        ) : null}
        {/* Görseller */}
        {message.images?.map((img, i) => (
          <img
            key={i}
            src={img}
            alt=""
            className="max-w-[320px] max-h-[220px] object-contain rounded-xl border border-line mb-3"
          />
        ))}

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
                  className="text-xs px-3.5 py-1.5 rounded-lg bg-brand text-white font-semibold hover:bg-branddim transition-colors"
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

        {/* Eylem butonları */}
        {message.content && !editing && (
          <div className="flex items-center gap-0.5 mt-2.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
