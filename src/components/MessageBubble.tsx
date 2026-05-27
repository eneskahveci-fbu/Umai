"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";

export function MessageBubble({
  message,
  showRegenerate,
  onRegenerate,
}: {
  message: ChatMessage;
  showRegenerate?: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* yoksay */
    }
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
        {isUser ? (
          <div className="whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
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
        {message.content && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft transition-colors"
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
            {showRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft transition-colors"
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
