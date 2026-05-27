"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Pencil, RefreshCw, X } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";

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
    <div className="group/msg flex gap-3 py-4">
      <div
        className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center text-sm font-bold ${
          isUser ? "bg-blue text-[#04203f]" : "brand-gradient text-white"
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
            className="max-w-[300px] max-h-[200px] object-cover rounded-lg border border-line mb-2"
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
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold"
                >
                  Gönder
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed">
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
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft"
            >
              {copied ? (
                <>
                  <Check size={12} /> Kopyalandı
                </>
              ) : (
                <>
                  <Copy size={12} /> Kopyala
                </>
              )}
            </button>
            {isUser && onEdit && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft"
              >
                <Pencil size={12} /> Düzenle
              </button>
            )}
            {showRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft"
              >
                <RefreshCw size={12} /> Yeniden oluştur
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
