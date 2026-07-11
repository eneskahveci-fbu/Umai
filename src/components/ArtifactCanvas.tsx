"use client";

import { Check, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, Eye, Link2, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { buildArtifactSrcDoc, artifactDownload } from "@/lib/artifactDoc";
import { ExportMenu } from "./studio/ExportMenu";

/* Paylaşılan Artifact görüntüleyici — sohbetin ArtifactPanel'i ile Tasarım
   Stüdyosu AYNI önizleme/sürüm/dışa-aktarma mekanizmasını kullansın diye
   buraya çıkarıldı (tek kaynak, iki çağıran). Sürüm geçmişi (index/total)
   ÇAĞIRANDAN gelir — kim "son 5 sürüm" mü yoksa "proje geçmişi" mi tuttuğuna
   kendi karar verir, bu bileşen yalnız gösterir/gezindirir. */
export interface ArtifactCanvasProps {
  artifact: Artifact;
  versionIndex?: number;
  versionTotal?: number;
  onPrevVersion?: () => void;
  onNextVersion?: () => void;
  onClose?: () => void;
  /** Örn. Tasarım Stüdyosu'nun "PDF (yazdır)" seçeneği — sohbetin panelinde yok. */
  extraExportOptions?: { key: string; label: string; icon: ReactNode; onSelect: () => void }[];
}

export function ArtifactCanvas({ artifact, versionIndex, versionTotal, onPrevVersion, onNextVersion, onClose, extraExportOptions }: ArtifactCanvasProps) {
  const addToast = useStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  /* İçerik değişince eski yayın bağlantısını temizle (render-anı türetme, effect yok). */
  const [prevKey, setPrevKey] = useState("");
  const curKey = `${artifact.type}|${artifact.content}`;
  if (curKey !== prevKey) {
    setPrevKey(curKey);
    setPublishedUrl(null);
  }

  const srcdoc = buildArtifactSrcDoc(artifact.type, artifact.content);
  const { ext, body: downloadBody } = artifactDownload(artifact.type, artifact.content);

  const copySource = async () => {
    try { await navigator.clipboard.writeText(artifact.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { addToast("Kopyalanamadı", "error"); }
  };
  const download = () => {
    const mime = artifact.type === "svg" ? "image/svg+xml" : "text/plain";
    const blob = new Blob([downloadBody], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(artifact.title || "artifact").replace(/\s+/g, "-").toLowerCase()}.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: artifact.title, type: artifact.type, content: artifact.content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        addToast(data.error || "Yayınlama başarısız.", "error");
        return;
      }
      const url = `${window.location.origin}/a/${data.id}`;
      setPublishedUrl(url);
      try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { /* yok say */ }
      addToast("Yayınlandı — bağlantı kopyalandı.", "success");
    } catch (e) {
      addToast((e as Error).message || "Yayınlama başarısız.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const iconBtn = "text-muted hover:text-ink p-1 rounded hover:bg-bgsoft transition-colors";
  const showVersionNav = (versionTotal ?? 0) > 1;

  return (
    <div
      role="region"
      aria-label={artifact.title || "Önizleme"}
      className={`shrink-0 border-line bg-surface flex flex-col transition-all ${
        expanded ? "fixed inset-0 z-50" : "w-full h-full"
      }`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-line gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate min-w-0">{artifact.title || "Önizleme"}</span>
          {showVersionNav && (
            <div className="flex items-center gap-0.5 shrink-0 text-[10px] font-mono text-muted/70 bg-bgsoft border border-line/60 rounded-lg px-1 py-0.5">
              <button onClick={onPrevVersion} disabled={versionIndex === 0} className="disabled:opacity-30 hover:text-ink" title="Önceki sürüm"><ChevronLeft size={13} /></button>
              <span>v{(versionIndex ?? 0) + 1}/{versionTotal}</span>
              <button onClick={onNextVersion} disabled={versionIndex === (versionTotal ?? 1) - 1} className="disabled:opacity-30 hover:text-ink" title="Sonraki sürüm"><ChevronRight size={13} /></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 mr-1">
            <button onClick={() => setView("preview")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "preview" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Önizleme"><Eye size={12} /> Önizleme</button>
            <button onClick={() => setView("code")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Kaynak kod"><Code2 size={12} /> Kod</button>
          </div>

          <button onClick={copySource} className={iconBtn} title="Kaynağı kopyala">{copied ? <Check size={15} className="text-brand" /> : <Copy size={15} />}</button>
          <ExportMenu
            triggerLabel="Dışa aktar"
            busy={publishing}
            options={[
              { key: "download", label: "İndir", icon: <Download size={14} />, onSelect: download },
              { key: "publish", label: "Yayınla (bağlantı)", icon: <Link2 size={14} />, onSelect: publish },
              ...(view === "preview" ? [
                { key: "reload", label: "Yenile", icon: <RotateCw size={14} />, onSelect: () => setReloadKey((k) => k + 1), separatorBefore: true },
                { key: "open-tab", label: "Yeni sekmede aç", icon: <ExternalLink size={14} />, onSelect: () => {
                  const blob = new Blob([srcdoc], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank", "noopener");
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                } },
              ] : []),
              ...(extraExportOptions ?? []),
            ]}
          />
          <button onClick={() => setExpanded(!expanded)} className={iconBtn} title={expanded ? "Küçült" : "Büyüt"}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          {onClose && <button onClick={() => { onClose(); setExpanded(false); }} className={iconBtn} title="Kapat"><X size={15} /></button>}
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
            key={`${reloadKey}-${versionIndex ?? 0}`}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-modals"
            allow=""
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
            title="Artifact preview"
          />
        ) : (
          <pre className="w-full h-full overflow-auto m-0 p-4 text-[12px] leading-relaxed font-mono bg-codebg text-[#d6d6d6]"><code>{artifact.content}</code></pre>
        )}
      </div>
    </div>
  );
}
