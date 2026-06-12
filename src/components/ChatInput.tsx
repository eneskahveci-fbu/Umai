"use client";

// src/components/ChatInput.tsx — Sohbet girdi alanı (alt araç çubuğu + gönder)

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import {
  Send,
  Paperclip,
  Globe,
  Palette,
  Mic,
  StopCircle,
  FileText,
} from "lucide-react";
import { useStore } from "@/lib/store";

interface Props {
  onSend: (content: string, attachments?: File[]) => void;
  onStop?: () => void;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  streaming = false,
  placeholder = "Mesajınızı yazın...",
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setInput("");
    setAttachments([]);
    // Textarea yüksekliğini sıfırla
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, attachments, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const startVoice = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
    recognition.lang = "tr-TR";
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  };

  return (
    <div className="border-t border-line bg-surface/50 px-4 py-3">
      {/* Dosya ekleri */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bgsoft border border-line text-xs"
            >
              <FileText size={12} />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-muted hover:text-red-400 transition-colors ml-1"
                title="Kaldır"
                aria-label={`${file.name} ekini kaldır`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Girdi alanı */}
      <div className="flex items-end gap-2 bg-bgsoft border border-line rounded-2xl px-3 py-2 focus-within:border-amber-400/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-ink placeholder:text-muted max-h-[200px] py-1.5"
          aria-label="Mesaj"
        />

        {/* Alt araçlar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Dosya ekle */}
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              aria-label="Dosya seç"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-surface rounded-lg transition-colors text-muted hover:text-ink"
              title="Dosya ekle"
              aria-label="Dosya ekle"
            >
              <Paperclip size={16} />
            </button>
          </>

          {/* Web arama */}
          <button
            className="p-1.5 hover:bg-surface rounded-lg transition-colors text-muted hover:text-ink"
            title="Web'de ara"
            aria-label="Web'de ara"
          >
            <Globe size={16} />
          </button>

          {/* Canvas/önizleme */}
          <button
            className="p-1.5 hover:bg-surface rounded-lg transition-colors text-muted hover:text-ink"
            title="Canvas önizleme"
            aria-label="Canvas önizleme"
          >
            <Palette size={16} />
          </button>

          {/* Sesli giriş */}
          <button
            onClick={startVoice}
            className={`p-1.5 hover:bg-surface rounded-lg transition-colors ${
              listening ? "text-red-400" : "text-muted hover:text-ink"
            }`}
            title={listening ? "Dinleniyor..." : "Sesli giriş"}
            aria-label={listening ? "Dinleniyor" : "Sesli giriş"}
          >
            <Mic size={16} />
          </button>

          {/* Gönder / Durdur */}
          {streaming ? (
            <button
              onClick={onStop}
              className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-400 transition-colors"
              title="Durdur"
              aria-label="Akışı durdur"
            >
              <StopCircle size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
              className="p-1.5 bg-amber-400 text-black rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Gönder"
              aria-label="Mesajı gönder"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
