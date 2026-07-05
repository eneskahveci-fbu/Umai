"use client";

import { Check, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, Eye, Link2, Loader2, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { buildArtifactSrcDoc, artifactDownload } from "@/lib/artifactDoc";

export function ArtifactPanel() {
  const artifact = useStore((s) => s.artifact);
  const setArtifact = useStore((s) => s.setArtifact);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  /* Yayınlama: artifact'ı bağımsız paylaşılabilir bir sayfaya (/a/<id>) çevirir. */
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  /* Sürüm geçmişi — aynı panel güncellendikçe son 5 sürümü tut, ‹ › ile gezin.
     Render-anı türetme (effect yok): içerik değişince geçmişe ekle, son sürümü göster. */
  const [versions, setVersions] = useState<Artifact[]>([]);
  const [vIndexRaw, setVIndex] = useState(999);
  const [prevKey, setPrevKey] = useState("");
  const curKey = artifact ? `${artifact.type}|${artifact.content}` : "";
  if (curKey !== prevKey) {
    setPrevKey(curKey);
    setPublishedUrl(null); // içerik değişti → eski yayın bağlantısını temizle
    if (!artifact) { setVersions([]); }
    else {
      setVersions((prev) => {
        const top = prev[prev.length - 1];
        if (top && top.content === artifact.content && top.type === artifact.type) return prev;
        return [...prev, artifact].slice(-5);
      });
      setVIndex(999); // yeni sürüm gelince en sona git
    }
  }

  if (!artifact) return null;
  const vIndex = Math.min(vIndexRaw, Math.max(0, versions.length - 1));
  const shown = versions[vIndex] ?? artifact;

  const srcdoc = buildArtifactSrcDoc(shown.type, shown.content);
  const { ext, body: downloadBody } = artifactDownload(shown.type, shown.content);

  const copySource = async () => {
    try { await navigator.clipboard.writeText(shown.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { useStore.getState().addToast("Kopyalanamadı", "error"); }
  };
  const download = () => {
    const mime = shown.type === "svg" ? "image/svg+xml" : "text/plain";
    const blob = new Blob([downloadBody], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(shown.title || "artifact").replace(/\s+/g, "-").toLowerCase()}.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: shown.title, type: shown.type, content: shown.content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        useStore.getState().addToast(data.error || "Yayınlama başarısız.", "error");
        return;
      }
      const url = `${window.location.origin}/a/${data.id}`;
      setPublishedUrl(url);
      try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { /* yok say */ }
      useStore.getState().addToast("Yayınlandı — bağlantı kopyalandı.", "success");
    } catch (e) {
      useStore.getState().addToast((e as Error).message || "Yayınlama başarısız.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const iconBtn = "text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors";

  return (
    <div
      role="region"
      aria-label={shown.title || "Önizleme"}
      className={`shrink-0 border-line bg-surface flex flex-col transition-all ${
        expanded ? "fixed inset-0 z-50" : "w-full h-full"
      }`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-line gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate min-w-0">{shown.title || "Önizleme"}</span>
          {/* Sürüm gezinme (Claude Artifacts gibi) */}
          {versions.length > 1 && (
            <div className="flex items-center gap-0.5 shrink-0 text-[10px] font-mono text-muted/70 bg-bgsoft border border-line/60 rounded-lg px-1 py-0.5">
              <button onClick={() => setVIndex((i) => Math.max(0, i - 1))} disabled={vIndex === 0} className="disabled:opacity-30 hover:text-ink" title="Önceki sürüm"><ChevronLeft size={13} /></button>
              <span>v{vIndex + 1}/{versions.length}</span>
              <button onClick={() => setVIndex((i) => Math.min(versions.length - 1, i + 1))} disabled={vIndex === versions.length - 1} className="disabled:opacity-30 hover:text-ink" title="Sonraki sürüm"><ChevronRight size={13} /></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Önizleme / Kod geçişi (Claude Artifacts gibi) */}
          <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 mr-1">
            <button onClick={() => setView("preview")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "preview" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Önizleme"><Eye size={12} /> Önizleme</button>
            <button onClick={() => setView("code")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Kaynak kod"><Code2 size={12} /> Kod</button>
          </div>

          <button onClick={copySource} className={iconBtn} title="Kaynağı kopyala">{copied ? <Check size={15} className="text-brand" /> : <Copy size={15} />}</button>
          <button onClick={download} className={iconBtn} title="İndir"><Download size={15} /></button>
          <button onClick={publish} disabled={publishing} className={iconBtn} title="Yayınla (paylaşılabilir bağlantı)">
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
          </button>
          {view === "preview" && (
            <>
              <button onClick={() => setReloadKey((k) => k + 1)} className={iconBtn} title="Yenile"><RotateCw size={15} /></button>
              <button
                onClick={() => {
                  const blob = new Blob([srcdoc], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank", "noopener");
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }}
                className={iconBtn} title="Yeni sekmede aç"
              ><ExternalLink size={15} /></button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)} className={iconBtn} title={expanded ? "Küçült" : "Büyüt"}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <button onClick={() => { setArtifact(null); setExpanded(false); }} className={iconBtn} title="Kapat"><X size={15} /></button>
        </div>
      </div>

      {publishedUrl && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-line bg-brand/5 text-[11px]">
          <Link2 size={12} className="text-brand shrink-0" />
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate min-w-0 flex-1">{publishedUrl}</a>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(publishedUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { /* yok say */ } }}
            className="shrink-0 flex items-center gap-1 text-muted hover:text-ink font-semibold"
          >{linkCopied ? <><Check size={12} /> Kopyalandı</> : "Kopyala"}</button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white">
        {view === "preview" ? (
          <iframe
            key={`${reloadKey}-${vIndex}`}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-modals"
            allow=""
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
            title="Artifact preview"
          />
        ) : (
          <pre className="w-full h-full overflow-auto m-0 p-4 text-[12px] leading-relaxed font-mono bg-codebg text-[#d6d6d6]"><code>{shown.content}</code></pre>
        )}
      </div>
    </div>
  );
}
