"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, ChevronDown, ChevronRight, Copy, Loader2, Pencil, RefreshCw, Wrench, X } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
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
  showRegenerate,
  onRegenerate,
  onEdit,
}: {
  message: ChatMessage;
  index: number;
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onEdit?: (index: number, content: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

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
          </div>
        )}
      </div>
    </div>
  );
}
