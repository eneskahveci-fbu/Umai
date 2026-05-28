"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Brain,
  Globe,
  Image as ImageIcon,
  Paperclip,
  PanelLeft,
  Square,
  VenetianMask,
  Zap,
} from "lucide-react";

import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";

const SUGGESTIONS = [
  { icon: "🧑‍💻", text: "Python'da bir CLI argüman ayrıştırıcı yaz" },
  { icon: "🐛", text: "Bu hatayı açıkla: IndexError: list index out of range" },
  { icon: "⚡", text: "REST ile GraphQL arasındaki farklar neler?" },
  { icon: "📂", text: "Coder sekmesinden bir dosya seçip özetlememi iste" },
];

let currentAbort: AbortController | null = null;

function estimateTokens(messages: { content: string }[]): number {
  return Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 3);
}

export function ChatView() {
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const incognito = useStore((s) => s.incognito);
  const streaming = useStore((s) => s.streaming);
  const config = useStore((s) => s.config);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const pendingInput = useStore((s) => s.pendingInput);
  const setPendingInput = useStore((s) => s.setPendingInput);
  const followUpSuggestions = useStore((s) => s.followUpSuggestions);
  const setFollowUpSuggestions = useStore((s) => s.setFollowUpSuggestions);

  const [input, setInput] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [thinkingMode, setThinkingMode] = useState<null | "fast" | "pro">(null);

  const cycleThinking = () =>
    setThinkingMode((m) => (m === null ? "fast" : m === "fast" ? "pro" : null));
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const current = chats.find((c) => c.id === currentId) || null;
  const messages = current?.messages ?? [];
  const tokenEst = estimateTokens(messages);
  const tokenPct = Math.min((tokenEst / config.maxContext) * 100, 100);

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

  useEffect(() => {
    setSearchOn(config.webSearch);
  }, [config.webSearch]);

  const fetchFollowUps = useCallback(async () => {
    const store = useStore.getState();
    if (!store.config.followUps) return;
    const active = store.activeModel();
    if (!active) return;
    const chat = store.current();
    if (!chat || chat.messages.length < 2) return;
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
          baseUrl: active.baseUrl,
          model: active.model,
          apiKey: active.apiKey,
        }),
      });
      const { suggestions } = await res.json();
      store.setFollowUpSuggestions(suggestions || []);
    } catch {
      /* yoksay */
    }
  }, []);

  const callApi = useCallback(
    async (searchContext?: string) => {
      const store = useStore.getState();
      const active = store.activeModel();
      if (!active) {
        store.setSettingsOpen(true);
        return;
      }

      const apiMessages = (store.current()?.messages ?? []).map((m) => {
        if (m.images?.length) {
          const content: unknown[] = m.images.map((img) => ({
            type: "image_url",
            image_url: { url: img },
          }));
          content.push({ type: "text", text: m.content });
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      });

      store.pushMessage({ role: "assistant", content: "" });
      store.setStreaming(true);
      store.setFollowUpSuggestions([]);

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
            style: store.config.style,
            memories: store.config.memories,
            searchContext,
            projectPrompt: store.config.projects.find(
              (p) => p.id === store.config.activeProjectId,
            )?.systemPrompt,
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
          /* kullanıcı durdurdu */
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
        fetchFollowUps();
      }
    },
    [fetchFollowUps],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const store = useStore.getState();
    if (!store.activeModel()) {
      store.setSettingsOpen(true);
      return;
    }
    if (!store.currentId) store.newChat(incognito);

    store.pushMessage({
      role: "user",
      content: text,
      images: pendingImages.length ? [...pendingImages] : undefined,
    });
    store.maybeSetTitle(text);
    setInput("");
    setPendingImages([]);

    let searchCtx: string | undefined;
    if (searchOn) {
      try {
        const sr = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });
        const { results } = await sr.json();
        if (results?.length) {
          searchCtx = results
            .map(
              (r: { title: string; snippet: string }) =>
                `- ${r.title}: ${r.snippet}`,
            )
            .join("\n");
        }
      } catch {
        /* yoksay */
      }
    }

    await callApi(searchCtx);
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
    if (chat.messages[chat.messages.length - 1].role === "assistant") {
      store.popLastMessage();
    }
    await callApi();
  };

  const editAndResend = async (index: number, content: string) => {
    const store = useStore.getState();
    store.editMessageAt(index, content);
    store.truncateAfter(index);
    await callApi();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const readFileIntoInput = (file: File) => {
    if (file.type.startsWith("image/")) {
      if (file.size > 5_000_000) {
        useStore.getState().addToast("Görsel 5MB'den büyük.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
      return;
    }
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) readFileIntoInput(f);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      for (const f of files) readFileIntoInput(f);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Üst bar */}
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line/60 bg-surface/60 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          title="Yan panel (Ctrl+B)"
          className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-bgsoft grid place-items-center transition-colors shrink-0"
        >
          <PanelLeft size={17} />
        </button>

        <div className="flex-1 min-w-0">
          {config.models.length > 0 ? (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors group max-w-full"
              title="Ayarlar"
            >
              <span className="w-2 h-2 rounded-full bg-green shrink-0" />
              <span className="truncate font-medium text-ink">
                {config.models.find((m) => m.id === config.activeModelId)?.label ||
                  config.models.find((m) => m.id === config.activeModelId)?.model ||
                  "Model seç"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-brand/40 text-brand hover:bg-brand/10 transition-colors"
            >
              + Model ekle
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {incognito && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple/10 text-purple border border-purple/30">
              <VenetianMask size={11} /> Gizli
            </span>
          )}
          {/* Token çubuğu */}
          {messages.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2"
              title={`~${tokenEst} token / ${config.maxContext}`}
            >
              <div className="w-14 h-1 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tokenPct > 80 ? "bg-red" : tokenPct > 60 ? "bg-yellow" : "bg-brand"
                  }`}
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted/60 font-mono tabular-nums">{Math.round(tokenPct)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto px-5 pt-[10vh] text-center">
            <div className="w-16 h-16 rounded-2xl brand-gradient grid place-items-center text-white text-3xl mx-auto mb-6 shadow-lg shadow-brand/20">
              ◆
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              {incognito ? "Gizli Sohbet" : "Ne üzerinde çalışalım?"}
            </h2>
            <p className="text-muted mt-2.5 text-sm leading-relaxed max-w-sm mx-auto">
              {incognito
                ? "Bu sohbet hiçbir yere kaydedilmez. Sekmeyi kapattığında silinir."
                : "Kod yaz, hata ayıkla, mimari öner — veya aşağıdaki önerilerden birini seç."}
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-8 text-left">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => setInput(s.text)}
                  className="group/sug flex items-start gap-3 p-4 rounded-2xl border border-line bg-surface hover:border-brand/50 hover:bg-surface2 text-sm transition-all duration-200"
                >
                  <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
                  <span className="text-muted group-hover/sug:text-ink transition-colors leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6">
            {messages.map((m, i) => {
              const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
              return (
                <MessageBubble
                  key={i}
                  index={i}
                  message={m}
                  showRegenerate={isLastAssistant && !streaming}
                  onRegenerate={regenerate}
                  onEdit={m.role === "user" ? editAndResend : undefined}
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
            {/* Takip soruları */}
            {!streaming && followUpSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 mb-4">
                {followUpSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s);
                      setFollowUpSuggestions([]);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface hover:border-branddim transition-colors text-muted hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pt-2 pb-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <div className="max-w-3xl mx-auto px-5">
          {/* Bekleyen görseller */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 mb-2.5 flex-wrap">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group/img">
                  <img
                    src={img}
                    alt=""
                    className="w-16 h-16 object-cover rounded-xl border border-line shadow-sm"
                  />
                  <button
                    onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red text-white grid place-items-center text-xs opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-3 py-2.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_3px_rgba(124,92,255,0.08)] transition-all duration-200">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.toml,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.swift,.kt,.xml,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFileIntoInput(f);
                e.target.value = "";
              }}
            />
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFileIntoInput(f);
                e.target.value = "";
              }}
            />
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder="Mesajınızı yazın..."
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed max-h-[200px] py-1.5 placeholder:text-muted/50"
            />
            {streaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-9 h-9 rounded-xl bg-red hover:bg-red/80 text-white grid place-items-center transition-colors"
                title="Durdur"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() && pendingImages.length === 0}
                className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>

          {/* Alt araç çubuğu */}
          <div className="flex items-center justify-between mt-2 px-0.5">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => fileRef.current?.click()}
                title="Dosya ekle"
                className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink hover:bg-bgsoft px-2 py-1.5 rounded-lg transition-colors"
              >
                <Paperclip size={13} />
              </button>
              <button
                onClick={() => imgRef.current?.click()}
                title="Görsel ekle"
                className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink hover:bg-bgsoft px-2 py-1.5 rounded-lg transition-colors"
              >
                <ImageIcon size={13} />
              </button>
              <button
                onClick={() => setSearchOn(!searchOn)}
                title={searchOn ? "Web aramayı kapat" : "Web aramayı aç"}
                className={`flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors ${
                  searchOn ? "text-brand bg-brand/10" : "text-muted hover:text-ink hover:bg-bgsoft"
                }`}
              >
                <Globe size={13} />
                <span>Web</span>
              </button>
              <button
                onClick={() => useStore.getState().setPromptLibraryOpen(true)}
                title="Şablon kütüphanesi"
                className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink hover:bg-bgsoft px-2 py-1.5 rounded-lg transition-colors"
              >
                <BookOpen size={13} />
                <span>Şablonlar</span>
              </button>

              {/* Düşünme modu */}
              <button
                onClick={cycleThinking}
                title="Düşünme modunu değiştir"
                className={`flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg transition-colors ${
                  thinkingMode === "pro"
                    ? "text-brand bg-brand/10 font-semibold"
                    : thinkingMode === "fast"
                    ? "text-amber-400 bg-amber-400/10 font-semibold"
                    : "text-muted hover:text-ink hover:bg-bgsoft"
                }`}
              >
                {thinkingMode === "pro" ? (
                  <Brain size={13} />
                ) : thinkingMode === "fast" ? (
                  <Zap size={13} />
                ) : (
                  <Brain size={13} />
                )}
                <span>
                  {thinkingMode === "pro"
                    ? "Pro Düşünce"
                    : thinkingMode === "fast"
                    ? "Hızlı Düşünce"
                    : "Düşünce"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted/50">
              {searchOn && <span className="text-brand font-medium">Web açık</span>}
              {searchOn && <span>·</span>}
              <span className="font-medium">craft.ai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
