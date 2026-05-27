"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Pencil, RefreshCw, X } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";

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
