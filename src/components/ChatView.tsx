"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Download,
  Menu,
  Paperclip,
  RefreshCw,
  Square,
  VenetianMask,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import { SelectorBar } from "./SelectorBar";

const SUGGESTIONS = [
  "Python'da bir CLI argüman ayrıştırıcı yaz",
  "Bu hatayı açıkla: IndexError: list index out of range",
  "REST ile GraphQL arasındaki farklar neler?",
  "Coder sekmesinden bir dosya seçip özetlememi iste",
];

let currentAbort: AbortController | null = null;

export function ChatView() {
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const pendingInput = useStore((s) => s.pendingInput);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const exportChat = useStore((s) => s.exportChat);

  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null);
      taRef.current?.focus();
    }
  }, [pendingInput, setPendingInput]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const callApi = useCallback(async () => {
    const store = useStore.getState();
    const active = store.activeModel();
    if (!active) {
      store.setSettingsOpen(true);
      return;
    }

    const apiMessages = (store.current()?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    store.pushMessage({ role: "assistant", content: "" });
    store.setStreaming(true);

    currentAbort = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentAbort.signal,
        body: JSON.stringify({
          messages: apiMessages,
          baseUrl: active.baseUrl,
          model: active.model,
          apiKey: active.apiKey,
          provider: active.provider,
          systemPrompt: store.config.systemPrompt,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              useStore.getState().updateLastContent(full);
            }
          } catch {
            /* parçalı satır */
          }
        }
      }
      if (!full) {
        useStore.getState().updateLastContent("_(Model boş yanıt döndürdü.)_");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // kullanıcı durdurdu — mevcut içeriği koru
      } else {
        useStore
          .getState()
          .updateLastContent(
            `**Hata:** ${(err as Error).message}\n\n_Anahtar/model doğru mu? Ayarlardan kontrol et._`,
          );
      }
    } finally {
      currentAbort = null;
      useStore.getState().setStreaming(false);
      await useStore.getState().persistCurrent();
    }
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const store = useStore.getState();
    const active = store.activeModel();

    if (!active) {
      store.setSettingsOpen(true);
      return;
    }
    if (!store.currentId) store.newChat(incognito);

    store.pushMessage({ role: "user", content: text });
    store.maybeSetTitle(text);
    setInput("");

    await callApi();
  };

  const stop = () => {
    currentAbort?.abort();
    currentAbort = null;
  };

  const regenerate = async () => {
    if (streaming) return;
    const store = useStore.getState();
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;

    const last = chat.messages[chat.messages.length - 1];
    if (last.role === "assistant") {
      store.popLastMessage();
    }
    await callApi();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    readFileIntoInput(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileIntoInput(file);
    e.target.value = "";
  };

  const readFileIntoInput = (file: File) => {
    if (file.size > 512_000) {
      useStore.getState().addToast("Dosya 512KB'den büyük.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const ext = file.name.split(".").pop() || "";
      setInput(
        (prev) =>
          prev +
          (prev ? "\n\n" : "") +
          `\`${file.name}\`:\n\`\`\`${ext}\n${text}\n\`\`\``,
      );
      taRef.current?.focus();
    };
    reader.readAsText(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files[0];
    if (file && file.type.startsWith("text/")) {
      e.preventDefault();
      readFileIntoInput(file);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Üst bar */}
      <div className="min-h-14 shrink-0 flex items-center gap-3 px-4 py-2 border-b border-line flex-wrap">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden text-muted"
        >
          <Menu size={20} />
        </button>
        <SelectorBar />
        {incognito && (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple/15 text-purple border border-purple/40">
            <VenetianMask size={12} /> Gizli
          </span>
        )}
        {current && current.messages.length > 0 && (
          <button
            onClick={() => exportChat(current.id)}
            title="Sohbeti indir (.md)"
            className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-bgsoft"
          >
            <Download size={14} />
          </button>
        )}
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto px-5 pt-[12vh] text-center">
            <div className="w-14 h-14 rounded-2xl brand-gradient grid place-items-center text-white text-2xl mx-auto mb-5">
              ◆
            </div>
            <h2 className="text-2xl font-extrabold">
              {incognito ? "Gizli Sohbet" : "Merhaba"}
            </h2>
            <p className="text-muted mt-2">
              {incognito
                ? "Bu sohbet hiçbir yere kaydedilmez."
                : "craft.ai ile kod yaz, açıklat, hata ayıkla."}
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-7 text-left">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="p-3.5 rounded-xl border border-line bg-surface hover:border-branddim text-sm transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6">
            {messages.map((m, i) => {
              const isLastAssistant =
                m.role === "assistant" && i === messages.length - 1;
              return (
                <MessageBubble
                  key={i}
                  message={m}
                  showRegenerate={isLastAssistant && !streaming}
                  onRegenerate={regenerate}
                />
              );
            })}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-3 py-4">
                <div className="shrink-0 w-8 h-8 rounded-lg brand-gradient grid place-items-center text-white text-sm font-bold">
                  ✦
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="typing-dot" />
                  <span className="typing-dot delay-1" />
                  <span className="typing-dot delay-2" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className="shrink-0 border-t border-line bg-bg py-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-3 py-2.5 focus-within:border-branddim transition-colors">
            <button
              onClick={() => fileRef.current?.click()}
              title="Dosya ekle"
              className="shrink-0 text-muted hover:text-ink p-1.5"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.swift,.kt,.xml,.csv,.env,.cfg,.ini,.log"
              className="hidden"
              onChange={handleFileSelect}
            />
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder="Bir mesaj yaz... (Enter = gönder, Shift+Enter = yeni satır)"
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed max-h-[200px] py-1.5"
            />
            {streaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-9 h-9 rounded-xl bg-red/80 hover:bg-red text-white grid place-items-center transition-colors"
                title="Durdur"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-muted mt-2">
            Anahtarların yalnızca senin cihazında saklanır · craft.ai
          </p>
        </div>
      </div>
    </div>
  );
}
