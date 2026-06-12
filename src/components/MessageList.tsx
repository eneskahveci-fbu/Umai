"use client";

// src/components/MessageList.tsx — Sohbet mesaj listesi (sanal kaydırma destekli)

import { useRef, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Props {
  messages: ChatMessage[];
  streaming?: boolean;
  streamingContent?: string;
}

export function MessageList({
  messages,
  streaming = false,
  streamingContent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Otomatik kaydırma
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-5xl">🤖</div>
          <h2 className="text-xl font-semibold text-ink">Craft.Coder</h2>
          <p className="text-sm">
            Kod yazabilir, açıklayabilir, hata ayıklayabilir ve mimari önerebilirim.
            Başlamak için bir mesaj yazın.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Streaming placeholder */}
      {streaming && streamingContent && (
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-sm shrink-0">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <MarkdownRenderer content={streamingContent} />
            <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-1.5 rounded-full bg-bgsoft border border-line text-xs text-muted max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
          isUser ? "bg-amber-400/20" : "bg-amber-400/20"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>

      {/* İçerik */}
      <div
        className={`flex-1 min-w-0 ${
          isUser
            ? "bg-amber-400/10 rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%]"
            : ""
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Artifact'ler */}
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.artifacts.map((a) => (
              <div
                key={a.id}
                className="border border-line rounded-xl overflow-hidden"
              >
                {a.type === "html" && (
                  <iframe
                    srcDoc={a.content}
                    className="w-full h-64 border-0"
                    title={a.title ?? "HTML önizleme"}
                    sandbox="allow-scripts"
                  />
                )}
                {a.type === "svg" && (
                  <div
                    dangerouslySetInnerHTML={{ __html: a.content }}
                    className="p-4 flex justify-center"
                  />
                )}
                {a.type === "code" && (
                  <pre className="p-4 text-sm overflow-auto">
                    <code>{a.content}</code>
                  </pre>
                )}
                {a.title && (
                  <div className="px-3 py-1.5 bg-bgsoft border-b border-line text-xs text-muted">
                    {a.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
