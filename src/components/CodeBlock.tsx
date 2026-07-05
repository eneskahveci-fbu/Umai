"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, ChevronDown, ChevronUp, Copy, Download, Eye, GitCompareArrows, Loader2, Play, Terminal } from "lucide-react";
import { useStore } from "@/lib/store";
import { buildSingleBlockPreview } from "@/lib/preview";
import { runPython } from "@/lib/python";
import { runJs } from "@/lib/jsRunner";

const COLLAPSE_LINE_THRESHOLD = 30;
const COLLAPSED_PX = 240;

export function CodeBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [pyOut, setPyOut] = useState<{ output: string; error?: string } | null>(null);
  const [pyRunning, setPyRunning] = useState(false);

  useEffect(() => {
    const text = preRef.current?.textContent ?? "";
    const lines = text === "" ? 0 : text.split("\n").length;
    setLineCount(lines);
    if (lines > COLLAPSE_LINE_THRESHOLD) setCollapsed(true);
  }, [children]);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const codeProps = (codeChild as React.ReactElement<{ className?: string; "data-file"?: string }>)?.props;
  const className = codeProps?.className || "";
  /* `dil:dosya/yolu` fence'inde remarkSplitFileLang yolu data-file'a taşır;
     dil sınıfı zaten temiz (language-ts) olduğundan başlıkta temiz dil görünür. */
  const filePath = codeProps?.["data-file"] || "";
  const lang = className
    .replace(/language-/g, "")
    .replace(/hljs/g, "")
    .trim();

  const isPreviewable = ["html", "svg", "htm", "mermaid", "css", "js", "javascript", "mjs", "jsx", "tsx", "react"].includes(lang);
  const isRunnable = ["bash", "sh", "shell", "zsh"].includes(lang);
  const isPython = ["python", "py"].includes(lang);
  /* Satır-içi JS çalıştırma (konsol çıktısı) — DOM'lu önizleme ayrı (Önizle). */
  const isJs = ["js", "javascript", "mjs"].includes(lang);

  const getText = () => preRef.current?.textContent || "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* yoksay */ }
  };

  const preview = () => {
    const art = buildSingleBlockPreview(lang, getText());
    if (art) useStore.getState().setArtifact(art);
  };

  /* Kod bloğunu dosya olarak indir — fence'te dosya yolu varsa adıyla,
     yoksa dile uygun uzantıyla. */
  const EXT: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", javascript: "js", mjs: "mjs", jsx: "jsx",
    python: "py", py: "py", html: "html", htm: "html", css: "css", json: "json",
    md: "md", markdown: "md", bash: "sh", sh: "sh", shell: "sh", zsh: "sh",
    sql: "sql", yaml: "yml", yml: "yml", svg: "svg", mermaid: "mmd", react: "tsx",
  };
  const download = () => {
    const code = getText();
    if (!code.trim()) return;
    const name = filePath ? filePath.split("/").pop()! : `kod.${EXT[lang] ?? "txt"}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const saveSnippet = () => {
    const code = getText().trim();
    if (!code) return;
    const firstLine = code.split("\n")[0].slice(0, 60);
    const title = firstLine.replace(/^\s*[/#-]+\s*/, "").trim() || `${lang || "code"} snippet`;
    useStore.getState().addSnippet({ title, language: lang || "text", code });
    useStore.getState().addToast("Snippet kaydedildi", "success");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const runInTerminal = () => {
    const code = getText().trim();
    if (!code) return;
    window.dispatchEvent(new CustomEvent("craftai:terminal-run", { detail: { command: code } }));
    useStore.getState().addToast("Terminal'e gönderildi", "success");
  };

  const runPy = async () => {
    const code = getText();
    if (!code.trim()) return;
    setPyRunning(true);
    setPyOut(null);
    const res = await runPython(code, () =>
      useStore.getState().addToast("Python (Pyodide) yükleniyor…", "info"),
    );
    setPyOut(res);
    setPyRunning(false);
  };

  const runJsCode = async () => {
    const code = getText();
    if (!code.trim()) return;
    setPyRunning(true);
    setPyOut(null);
    setPyOut(await runJs(code));
    setPyRunning(false);
  };

  const showDiff = () => {
    /* Editörde açık olan dosyayla karşılaştır — eski window.prompt yerine. */
    const open = useStore.getState().currentFile;
    if (!open) {
      useStore.getState().addToast("Karşılaştırmak için önce editörde bir dosya aç", "info");
      return;
    }
    useStore.getState().setDiffModal({
      original: open.content,
      newCode: getText(),
      language: lang || "text",
      path: open.path,
    });
  };

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between px-4 py-1.5 bg-codebg rounded-t-[10px] border border-b-0 border-line text-xs text-muted">
        <span className="font-mono flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{lang || "code"}</span>
          {filePath && <span className="text-muted/40 truncate">· {filePath}</span>}
        </span>
        <div className="flex items-center gap-2.5">
          {isPreviewable && (
            <button onClick={preview} className="flex items-center gap-1 hover:text-brand transition-colors">
              <Eye size={12} /> Önizle
            </button>
          )}
          {isRunnable && (
            <button onClick={runInTerminal} className="flex items-center gap-1 hover:text-green transition-colors" title="Terminal'de çalıştır">
              <Play size={12} /> Çalıştır
            </button>
          )}
          {isPython && (
            <button onClick={runPy} disabled={pyRunning} className="flex items-center gap-1 hover:text-green transition-colors disabled:opacity-50" title="Python'u tarayıcıda çalıştır (Pyodide)">
              {pyRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Çalıştır
            </button>
          )}
          {isJs && (
            <button onClick={runJsCode} disabled={pyRunning} className="flex items-center gap-1 hover:text-green transition-colors disabled:opacity-50" title="JS'i izole çalıştır (konsol çıktısı)">
              {pyRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Çalıştır
            </button>
          )}
          <button onClick={showDiff} className="flex items-center gap-1 hover:text-brand transition-colors" title="Editörde açık dosya ile karşılaştır">
            <GitCompareArrows size={12} /> Diff
          </button>
          <button onClick={saveSnippet} className="flex items-center gap-1 hover:text-brand transition-colors" title="Snippet kütüphanesine kaydet">
            {saved ? <><Check size={12} /> Kaydedildi</> : <><BookmarkPlus size={12} /> Kaydet</>}
          </button>
          <button onClick={download} className="flex items-center gap-1 hover:text-ink transition-colors" title="Dosya olarak indir">
            <Download size={12} /> İndir
          </button>
          <button onClick={copy} className="flex items-center gap-1 hover:text-ink transition-colors">
            {copied ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
          </button>
        </div>
      </div>
      <div className="relative">
        <pre
          ref={preRef}
          {...props}
          style={collapsed ? { maxHeight: COLLAPSED_PX, overflow: "hidden" } : undefined}
          className="!rounded-t-none !mt-0 !border-t-0"
        >
          {children}
        </pre>
        {collapsed && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-[10px]"
            style={{ background: "linear-gradient(to bottom, transparent, var(--color-bg) 95%)" }}
          />
        )}
        {lineCount > COLLAPSE_LINE_THRESHOLD && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="absolute left-1/2 -translate-x-1/2 bottom-2 flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-bgsoft/90 border border-line/60 text-muted hover:text-ink hover:bg-bgsoft backdrop-blur transition-colors shadow-sm"
          >
            {collapsed
              ? <><ChevronDown size={11} /> {lineCount} satırı göster</>
              : <><ChevronUp size={11} /> Katla</>
            }
          </button>
        )}
      </div>
      {/* Python (Pyodide) çıktısı */}
      {(pyOut || pyRunning) && (
        <div className="border border-t-0 border-line rounded-b-[10px] bg-codebg -mt-px">
          <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-line/40 text-[10px] uppercase tracking-wider text-muted/60 font-bold">
            <Terminal size={11} /> Çıktı
            {pyOut?.error && <span className="text-red/80 normal-case tracking-normal font-normal ml-1">· hata</span>}
            <button onClick={() => setPyOut(null)} className="ml-auto text-muted/40 hover:text-ink normal-case font-normal">temizle</button>
          </div>
          <pre className="px-4 py-2.5 text-[12px] font-mono whitespace-pre-wrap break-all max-h-72 overflow-auto m-0 !bg-transparent">
            {pyRunning && !pyOut ? <span className="text-muted/50">çalışıyor…</span> : (
              <>
                {pyOut?.output && <span className="text-ink/90">{pyOut.output}</span>}
                {pyOut?.error && <span className="text-red/80">{pyOut.output ? "\n" : ""}{pyOut.error}</span>}
                {pyOut && !pyOut.output && !pyOut.error && <span className="text-muted/50">(çıktı yok)</span>}
              </>
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
