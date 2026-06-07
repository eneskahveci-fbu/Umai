"use client";

import { useRef, useState, useEffect } from "react";
import Editor, { OnMount, useMonaco } from "@monaco-editor/react";
import { Check, Copy, GitCommit, Loader2, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { EditorFile } from "@/lib/editor";

export function EditorPanel({
  file,
  onClose,
  onAskAI,
}: {
  file: EditorFile;
  onClose: () => void;
  onAskAI?: (text: string, context: string) => void;
}) {
  const repo = useStore((s) => s.repo);
  const addToast = useStore((s) => s.addToast);
  const [value, setValue] = useState(file.content);
  const [dirty, setDirty] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [selection, setSelection] = useState("");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoInstance = useMonaco();
  const completionRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    setValue(file.content);
    setDirty(false);
    setShowCommit(false);
  }, [file.path, file.content]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection();
      if (!sel) { setSelection(""); return; }
      const model = editor.getModel();
      if (!model) { setSelection(""); return; }
      const text = model.getValueInRange(sel);
      setSelection(text.trim());
    });
  };

  useEffect(() => {
    if (!monacoInstance) return;
    completionRef.current?.dispose();

    const provider = monacoInstance.languages.registerInlineCompletionsProvider(
      { pattern: "**" },
      {
        provideInlineCompletions: async (model, position) => {
          const textBefore = model.getValueInRange({
            startLineNumber: 1, startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          if (textBefore.trim().length < 20) return { items: [] };
          const active = useStore.getState().activeModel();
          if (!active) return { items: [] };
          try {
            const res = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{
                  role: "user",
                  content: `Aşağıdaki ${file.language} kodunu tamamla. SADECE tamamlama kodunu yaz, açıklama yapma:\n\`\`\`${file.language}\n${textBefore}`,
                }],
                baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey,
                provider: active.provider,
              }),
            });
            if (!res.ok || !res.body) return { items: [] };
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let completion = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const data = t.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data);
                  completion += json.choices?.[0]?.delta?.content ?? "";
                } catch { /* skip */ }
              }
            }
            completion = completion.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
            if (!completion) return { items: [] };
            return {
              items: [{
                insertText: completion,
                range: new monacoInstance.Range(
                  position.lineNumber, position.column,
                  position.lineNumber, position.column
                ),
              }],
            };
          } catch { return { items: [] }; }
        },
        disposeInlineCompletions: () => {},
      }
    );
    completionRef.current = provider;
    return () => { provider.dispose(); };
  }, [monacoInstance, file.language]);

  const handleChange = (v: string | undefined) => {
    setValue(v ?? "");
    setDirty((v ?? "") !== file.content);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const commit = async () => {
    if (!repo) { addToast("Depo bağlı değil", "error"); return; }
    const activeGithub = useStore.getState().activeGithub();
    if (!activeGithub?.token) { addToast("GitHub token bulunamadı", "error"); return; }
    setCommitting(true);
    try {
      const res = await fetch("/api/github/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          path: file.path,
          content: value,
          message: commitMsg.trim() || `Update ${file.path}`,
          token: activeGithub.token,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      addToast("Dosya kaydedildi ✓", "success");
      setDirty(false);
      setShowCommit(false);
      setCommitMsg("");
    } catch (e) {
      addToast(`Hata: ${(e as Error).message}`, "error");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111110] border-l border-line/60">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/60 shrink-0 bg-surface">
        <span className="text-xs font-mono text-muted/70 flex-1 truncate">{file.path}</span>
        {dirty && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Kaydedilmemiş değişiklik" />}
        <button onClick={copy} className="text-muted hover:text-ink p-1 rounded transition-colors" title="Kopyala">
          {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
        </button>
        {selection && onAskAI && (
          <button
            onClick={() => onAskAI(selection, `Dosya: ${file.path}\n\`\`\`${file.language}\n${selection}\n\`\`\``)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-brand/10 text-brand hover:bg-brand/15 transition-colors font-semibold"
            title="Seçili kodu AI'ya sor"
          >
            <Sparkles size={12} /> AI&apos;ya Sor
          </button>
        )}
        {dirty && (
          <button
            onClick={() => setShowCommit((v) => !v)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-semibold"
          >
            <GitCommit size={12} /> Kaydet
          </button>
        )}
        <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Commit bar */}
      {showCommit && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand/5 border-b border-brand/20 shrink-0">
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder={`Update ${file.path}`}
            className="flex-1 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          />
          <button
            onClick={commit}
            disabled={committing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand hover:bg-branddim text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {committing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
            {committing ? "Kaydediliyor…" : "Commit"}
          </button>
        </div>
      )}

      {/* Monaco */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={file.language}
          value={value}
          onChange={handleChange}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            roundedSelection: true,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            inlineSuggest: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}

export default EditorPanel;
