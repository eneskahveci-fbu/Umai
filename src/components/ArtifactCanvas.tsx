"use client";

import { Check, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, Eye, Link2, Maximize2, Minimize2, MousePointerClick, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { buildArtifactSrcDoc, withAnnotationScript, artifactDownload, buildStandaloneSandboxDoc } from "@/lib/artifactDoc";
import { lintArtifact } from "@/lib/studioCraft";
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
  /** İşaretle & Değiştir (AI Studio Annotation Mode paraleli): verilirse araç
      çubuğunda toggle çıkar; kullanıcı önizlemede bir öğeye tıklayınca kısa,
      okunur bir tanımlayıcı (`<h2 class="hero"> "Başlık"`) ile çağrılır.
      Composer'a taşımak ÇAĞIRANIN işi (DesignStudio → kendi sohbeti,
      ArtifactPanel → craftai:composer-prefill). */
  onAnnotate?: (descriptor: string) => void;
}

export function ArtifactCanvas({ artifact, versionIndex, versionTotal, onPrevVersion, onNextVersion, onClose, extraExportOptions, onAnnotate }: ArtifactCanvasProps) {
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

  /* İşaretle & Değiştir — yalnız görsel türlerde anlamlı (html/svg; kod ve
     markdown'da "öğe" kavramı yok). Script YALNIZ canlı iframe'e enjekte
     edilir; indirme/yayın/yeni-sekme her zaman temiz baseSrcdoc kullanır. */
  const [annotating, setAnnotating] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const canAnnotate = !!onAnnotate && (artifact.type === "html" || artifact.type === "svg");

  useEffect(() => {
    if (!annotating || !onAnnotate) return;
    const onMsg = (e: MessageEvent) => {
      /* Sandbox'lı (opak origin) iframe '*' hedefiyle yollamak zorunda; güven
         burada kurulur: kaynak pencere bizim iframe'imiz mi + veri şekli doğru
         mu? İçerik LLM üretimi olduğundan descriptor'a asla kod gibi davranma —
         yalnız kırpılmış düz metin olarak composer'a taşınır. */
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { __umaiAnnotate?: boolean; descriptor?: unknown } | null;
      if (!data || data.__umaiAnnotate !== true || typeof data.descriptor !== "string") return;
      onAnnotate(data.descriptor.slice(0, 200));
      setAnnotating(false);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [annotating, onAnnotate]);

  const baseSrcdoc = buildArtifactSrcDoc(artifact.type, artifact.content, artifact.language);
  const srcdoc = annotating && canAnnotate ? withAnnotationScript(baseSrcdoc) : baseSrcdoc;
  const { ext, body: downloadBody } = artifactDownload(artifact.type, artifact.content, artifact.language);

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
        body: JSON.stringify({
          title: artifact.title,
          type: artifact.type,
          content: artifact.content,
          language: artifact.language,
        }),
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

  /* M3 — kalite denetimi artık Tasarım Stüdyosu'na özel değil: aynı kural
     tabanlı lintArtifact (studioCraft.ts) sohbette üretilen HTML
     artifact'larına da uygulanır. Bilinçli olarak YALNIZ kural tabanlı olan
     yarısı taşındı; Stüdyo'daki ek LLM eleştirisi (critiqueArtifact) sohbete
     alınmadı — her artifact'ta fazladan bir model çağrısı sohbete gecikme ve
     maliyet bindirirdi. Saf türetme: state yok, render'da hesaplanır. */
  const qualityNotes = artifact.type === "html" ? lintArtifact(artifact.content) : [];

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
              <button onClick={onPrevVersion} disabled={versionIndex === 0} className="disabled:opacity-30 hover:text-ink transition-colors" title="Önceki sürüm"><ChevronLeft size={13} /></button>
              <span>v{(versionIndex ?? 0) + 1}/{versionTotal}</span>
              <button onClick={onNextVersion} disabled={versionIndex === (versionTotal ?? 1) - 1} className="disabled:opacity-30 hover:text-ink transition-colors" title="Sonraki sürüm"><ChevronRight size={13} /></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 mr-1">
            <button onClick={() => setView("preview")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "preview" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Önizleme"><Eye size={12} /> <span className="hidden sm:inline">Önizleme</span></button>
            <button onClick={() => setView("code")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${view === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`} title="Kaynak kod"><Code2 size={12} /> <span className="hidden sm:inline">Kod</span></button>
          </div>

          {canAnnotate && view === "preview" && (
            <button
              onClick={() => setAnnotating((a) => !a)}
              className={annotating ? "text-brand bg-brand/10 p-1 rounded transition-colors" : iconBtn}
              title="İşaretle & Değiştir — önizlemede bir öğeye tıkla, değişiklik talimatını yaz"
              aria-label="İşaretle & Değiştir"
              aria-pressed={annotating}
            ><MousePointerClick size={15} /></button>
          )}
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
                  /* blob: URL oluşturan sayfanın origin'ini miras alır — untrusted
                     içeriği ÇIPLAK koymak sandbox'ı atlatırdı (bkz. artifactDoc.ts
                     buildStandaloneSandboxDoc yorumu). Dış kabuk script çalıştırmaz,
                     asıl içerik yine allow-same-origin'siz sandbox'lı iframe'e gömülür. */
                  const blob = new Blob([buildStandaloneSandboxDoc(baseSrcdoc)], { type: "text/html" });
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
            className="shrink-0 flex items-center gap-1 text-muted hover:text-ink font-semibold transition-colors"
          >{linkCopied ? <><Check size={12} /> Kopyalandı</> : "Kopyala"}</button>
        </div>
      )}

      {annotating && canAnnotate && view === "preview" && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-line bg-brand/5 text-[11px] text-brand">
          <MousePointerClick size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">Değiştirmek istediğin öğeye önizlemede tıkla — seçim sohbete taşınır.</span>
          <button onClick={() => setAnnotating(false)} className="shrink-0 text-muted hover:text-ink font-semibold transition-colors">Vazgeç</button>
        </div>
      )}

      {qualityNotes.length > 0 && (
        <div className="shrink-0 flex items-start gap-2 px-3 py-1.5 border-b border-line bg-yellow/5 text-[11px] text-muted">
          <span className="shrink-0 pt-px" aria-hidden>🧹</span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-ink/80">Kalite notu: </span>
            {qualityNotes.join(" · ")}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white">
        {view === "preview" ? (
          <iframe
            ref={frameRef}
            key={`${reloadKey}-${versionIndex ?? 0}-${annotating && canAnnotate ? "a" : "n"}`}
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
