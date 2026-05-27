"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Menu, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./CodeBlock";

export function CompareView() {
  const config = useStore((s) => s.config);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const compareModelA = useStore((s) => s.compareModelA);
  const compareModelB = useStore((s) => s.compareModelB);
  const setCompareModelA = useStore((s) => s.setCompareModelA);
  const setCompareModelB = useStore((s) => s.setCompareModelB);

  const [input, setInput] = useState("");
  const [streamingA, setStreamingA] = useState(false);
  const [streamingB, setStreamingB] = useState(false);
  const [responseA, setResponseA] = useState("");
  const [responseB, setResponseB] = useState("");
  const [prompt, setPrompt] = useState("");
  const abortA = useRef<AbortController | null>(null);
  const abortB = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const models = config.models;

  useEffect(() => {
    if (models.length >= 2) {
      if (!compareModelA) setCompareModelA(models[0].id);
      if (!compareModelB) setCompareModelB(models[1]?.id ?? models[0].id);
    } else if (models.length === 1) {
      if (!compareModelA) setCompareModelA(models[0].id);
      if (!compareModelB) setCompareModelB(models[0].id);
    }
  }, [models, compareModelA, compareModelB, setCompareModelA, setCompareModelB]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const streamModel = useCallback(
    async (
      model: { baseUrl: string; model: string; apiKey: string; provider: string },
      userPrompt: string,
      setResponse: (fn: (prev: string) => string) => void,
      setStreaming: (b: boolean) => void,
      abortRef: React.MutableRefObject<AbortController | null>,
    ) => {
      setStreaming(true);
      setResponse(() => "");
      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            messages: [{ role: "user", content: userPrompt }],
            baseUrl: model.baseUrl,
            model: model.model,
            apiKey: model.apiKey,
            provider: model.provider,
            systemPrompt: config.systemPrompt,
            style: config.style,
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                setResponse((prev) => prev + delta);
              }
            } catch {
              /* partial line */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResponse(() => `**Hata:** ${(err as Error).message}`);
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [config.systemPrompt, config.style],
  );

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (streamingA || streamingB) return;

    const modelA = models.find((m) => m.id === compareModelA);
    const modelB = models.find((m) => m.id === compareModelB);

    if (!modelA || !modelB) {
      useStore.getState().addToast("Karsilastirmak icin 2 model secin.", "error");
      return;
    }

    setPrompt(text);
    setInput("");

    streamModel(modelA, text, setResponseA, setStreamingA, abortA);
    streamModel(modelB, text, setResponseB, setStreamingB, abortB);
  };

  const stop = () => {
    abortA.current?.abort();
    abortB.current?.abort();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isStreaming = streamingA || streamingB;
  const modelALabel =
    models.find((m) => m.id === compareModelA)?.label ||
    models.find((m) => m.id === compareModelA)?.model ||
    "Model A";
  const modelBLabel =
    models.find((m) => m.id === compareModelB)?.label ||
    models.find((m) => m.id === compareModelB)?.model ||
    "Model B";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="min-h-14 shrink-0 flex items-center gap-3 px-4 py-2 border-b border-line flex-wrap">
        <button onClick={() => setSidebarOpen(true)} className="md:hidden text-muted">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold">Model Karsilastirma</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={compareModelA ?? ""}
            onChange={(e) => setCompareModelA(e.target.value)}
            className="bare-select text-[11px] bg-bgsoft border border-line rounded-lg px-2 py-1"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label || m.model}
              </option>
            ))}
          </select>
          <span className="text-muted text-xs">vs</span>
          <select
            value={compareModelB ?? ""}
            onChange={(e) => setCompareModelB(e.target.value)}
            className="bare-select text-[11px] bg-bgsoft border border-line rounded-lg px-2 py-1"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label || m.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responses side by side */}
      <div className="flex-1 overflow-hidden flex">
        {!prompt && !responseA && !responseB ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-5">
              <div className="w-14 h-14 rounded-2xl brand-gradient grid place-items-center text-white text-2xl mx-auto mb-5">
                &#x25C7;&#x25C7;
              </div>
              <h2 className="text-xl font-extrabold">Model Karsilastirma</h2>
              <p className="text-muted mt-2 max-w-md">
                Ayni promptu 2 farkli modele gonder ve yanitlarini yan yana karsilastir.
                {models.length < 2 && (
                  <span className="block mt-2 text-brand">
                    Karsilastirma icin en az 2 model ekleyin.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Model A */}
            <div className="flex-1 flex flex-col border-r border-line min-w-0">
              <div className="shrink-0 px-4 py-2 border-b border-line bg-bgsoft">
                <span className="text-xs font-bold text-brand">{modelALabel}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {prompt && (
                  <div className="mb-4 p-3 rounded-xl bg-bgsoft border border-line text-sm">
                    <span className="text-xs text-muted font-bold block mb-1">Prompt</span>
                    {prompt}
                  </div>
                )}
                {responseA ? (
                  <div className="prose-chat">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{ pre: CodeBlock }}
                    >
                      {responseA}
                    </ReactMarkdown>
                  </div>
                ) : streamingA ? (
                  <div className="flex items-center gap-1 pt-2">
                    <span className="typing-dot" />
                    <span className="typing-dot delay-1" />
                    <span className="typing-dot delay-2" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Model B */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="shrink-0 px-4 py-2 border-b border-line bg-bgsoft">
                <span className="text-xs font-bold text-brand">{modelBLabel}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {prompt && (
                  <div className="mb-4 p-3 rounded-xl bg-bgsoft border border-line text-sm">
                    <span className="text-xs text-muted font-bold block mb-1">Prompt</span>
                    {prompt}
                  </div>
                )}
                {responseB ? (
                  <div className="prose-chat">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{ pre: CodeBlock }}
                    >
                      {responseB}
                    </ReactMarkdown>
                  </div>
                ) : streamingB ? (
                  <div className="flex items-center gap-1 pt-2">
                    <span className="typing-dot" />
                    <span className="typing-dot delay-1" />
                    <span className="typing-dot delay-2" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-line bg-bg py-4">
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-end gap-2 bg-surface border border-line rounded-2xl px-3 py-2.5 focus-within:border-branddim transition-colors">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Her iki modele gonderilecek promptu yaz..."
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed max-h-[200px] py-1.5"
            />
            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-9 h-9 rounded-xl bg-red/80 hover:bg-red text-white grid place-items-center"
                title="Durdur"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-brand hover:bg-branddim text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
