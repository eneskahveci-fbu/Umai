"use client";

import { Check, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, Eye, GitBranch, Link2, Maximize2, Minimize2, MousePointerClick, Monitor, Presentation, RotateCw, Smartphone, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Artifact } from "@/lib/types";
import { buildArtifactSrcDoc, withAnnotationScript, artifactDownload, buildStandaloneSandboxDoc } from "@/lib/artifactDoc";
import { filesForArtifact, repoSlug } from "@/lib/exportRepo";
import { resolveGitToken } from "@/lib/secureKeys";
import { lintArtifactByType } from "@/lib/studioCraft";
import { STUDIO_DEVICES, deviceById, type DeviceId } from "@/lib/studioConstants";
import { DeviceFrame } from "./studio/DeviceFrame";
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
  /** N1 — sohbet panelinde "Stüdyo'da aç": artifact'ı bir StudioProject'e
      çevirip Tasarım Stüdyosu'nda devam ettirir. Yalnız ÇAĞIRAN verirse düğme
      çıkar — Stüdyo kendi içinde bunu geçmez (kendine yönlendiren anlamsız
      bir düğme olurdu). */
  onOpenInStudio?: () => void;
  /** U5 — cihaz (responsive) önizleme anahtarı. Yalnız Tasarım Stüdyosu'nun
      geniş tuvalinde anlamlı; sohbetin dar panelinde telefon çerçevesi zaten
      sığmayacağı için çağıran açıkça istemedikçe gösterilmez. */
  showDevicePicker?: boolean;
  /** W1 — belirli bir sürüme ATLA. Verilmezse yalnız ‹ › okları kalır
      (sohbet panelinde sürüm listesi açacak yer yok). */
  onSelectVersion?: (index: number) => void;
  /** W2 — kalite notlarını modele geri gönderip düzelttirme. Verilmezse not
      şeridi eskisi gibi salt-bilgi kalır. */
  onFixQuality?: (notes: string[]) => void;
  /** W3 — kromsuz tam ekran sunum modu. Yalnız görsel türlerde anlamlı. */
  enablePresent?: boolean;
}

export function ArtifactCanvas({ artifact, versionIndex, versionTotal, onPrevVersion, onNextVersion, onClose, extraExportOptions, onAnnotate, onOpenInStudio, showDevicePicker, onSelectVersion, onFixQuality, enablePresent }: ArtifactCanvasProps) {
  const addToast = useStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(false);
  const [deviceId, setDeviceId] = useState<DeviceId>("web");
  const [versionListOpen, setVersionListOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  /* "GitHub'a gönder" — Lovable/Replit döngüsünün kopuk halkası: önizlemede
     sıfırdan üretilen bir şeyi YENİ bir depoya göndermenin hiçbir yolu yoktu
     (ajan yalnız zaten bağlı bir depoya yazabiliyor, create_repo aracı yok).
     Akış: ad sor → depoyu oluştur (auto_init) → dosyaları tek commit'le yaz. */
  const githubAccounts = useStore((s) => s.config.githubAccounts);
  const activeGithubId = useStore((s) => s.config.activeGithubId);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [ghAsking, setGhAsking] = useState(false);
  const [ghName, setGhName] = useState("");
  const [ghPrivate, setGhPrivate] = useState(true);
  const [ghBusy, setGhBusy] = useState(false);
  const [ghUrl, setGhUrl] = useState<string | null>(null);
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
  const openGithubExport = () => {
    const acc = githubAccounts.find((a) => a.id === activeGithubId) ?? githubAccounts[0];
    if (!acc) {
      /* Hesap yoksa hatayla dönmek yerine doğrudan bağlama ekranına götür —
         kullanıcı ne yapacağını bilsin. */
      addToast("Önce Ayarlar → Git'ten bir GitHub hesabı bağla.", "error");
      setSettingsOpen(true);
      return;
    }
    setGhName(repoSlug(artifact.title));
    setGhUrl(null);
    setGhAsking(true);
  };
  const exportToGithub = async () => {
    if (ghBusy) return;
    const acc = githubAccounts.find((a) => a.id === activeGithubId) ?? githubAccounts[0];
    if (!acc) return;
    const name = repoSlug(ghName);
    setGhBusy(true);
    try {
      const token = await resolveGitToken(acc);
      /* 1) Depoyu oluştur (sunucu auto_init ile ilk commit'i garantiler). */
      const created = await fetch("/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, isPrivate: ghPrivate, description: artifact.title || "UMAI ile üretildi" }),
      });
      const c = await created.json().catch(() => ({}));
      if (!created.ok || !c.owner) { addToast(c.error || "Depo oluşturulamadı.", "error"); return; }
      /* 2) Dosyaları TEK commit'le yaz — mevcut batch-write ucu olduğu gibi. */
      const wrote = await fetch("/api/github/batch-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, owner: c.owner, repo: c.repo, branch: c.defaultBranch,
          message: `UMAI: ${artifact.title || "ilk sürüm"}`,
          files: filesForArtifact(artifact, window.location.origin),
        }),
      });
      const w = await wrote.json().catch(() => ({}));
      if (!wrote.ok) {
        /* Depo oluştu ama dosyalar yazılamadı: kullanıcı boş depoyu görmeli,
           çünkü tekrar denerse "ad zaten var" alır. */
        addToast(`${w.error || "Dosyalar yazılamadı."} Depo oluştu ama boş: ${c.htmlUrl}`, "error");
        setGhUrl(c.htmlUrl);
        return;
      }
      /* Çubuğu KAPATMA: bağlantı onun içinde. İlk sürüm burada setGhAsking(false)
         çağırıyordu ve kullanıcı yeni deposunun linkini hiç göremiyordu — yalnız
         3 saniyede solan bir toast. Lovable'da link kalıcıdır; burada da öyle. */
      setGhUrl(c.htmlUrl);
      addToast(`GitHub'a gönderildi: ${c.owner}/${c.repo} ✓`, "success");
    } catch (e) {
      addToast((e as Error).message || "GitHub'a gönderilemedi.", "error");
    } finally {
      setGhBusy(false);
    }
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

  /* M3+N3 — kalite denetimi artık ne Tasarım Stüdyosu'na ne de HTML'e özel:
     kural tabanlı denetim (studioCraft.ts) sohbette üretilen html, React
     önizlemesi, SVG ve mermaid çıktılarının HEPSİNE uygulanır. Bilinçli olarak YALNIZ kural tabanlı olan
     yarısı taşındı; Stüdyo'daki ek LLM eleştirisi (critiqueArtifact) sohbete
     alınmadı — her artifact'ta fazladan bir model çağrısı sohbete gecikme ve
     maliyet bindirirdi. Saf türetme: state yok, render'da hesaplanır. */
  const qualityNotes = lintArtifactByType(artifact.type, artifact.content);

  /* W1 — sürüm listesi: dışarı tıklama / Escape ile kapan (uygulamadaki
     diğer popover'larla aynı desen). */
  useEffect(() => {
    if (!versionListOpen) return;
    const onDown = (e: MouseEvent) => { if (!versionRef.current?.contains(e.target as Node)) setVersionListOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setVersionListOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [versionListOpen]);

  /* W3 — sunum modu: Escape ile çık. Ok tuşları iframe'in İÇİNDE çalışır
     (sandbox'lı belge kendi kaydırmasını yönetir); burada yalnız çıkış
     yakalanır — üst pencereden sandbox'a tuş enjekte etmek mümkün değil. */
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPresenting(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [presenting]);

  /* U5 — cihaz çerçevesi. iframe TEK bir yerde kurulur ve ister çıplak ister
     DeviceFrame içinde render edilir; böylece ref (İşaretle & Değiştir
     postMessage doğrulaması) ve key (sürüm/yeniden yükleme) tek kaynakta
     kalır — iki ayrı iframe kurmak o mekanizmayı koparırdı. */
  const device = deviceById(deviceId);
  const framed = !!showDevicePicker && view === "preview" && deviceId !== "web"
    && (artifact.type === "html" || artifact.type === "svg");
  const previewFrame = (
    <iframe
      ref={frameRef}
      key={`${reloadKey}-${versionIndex ?? 0}-${annotating && canAnnotate ? "a" : "n"}`}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-modals"
      allow=""
      referrerPolicy="no-referrer"
      className="w-full h-full border-0 bg-white"
      title="Artifact preview"
    />
  );

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
            <div ref={versionRef} className="relative flex items-center gap-0.5 shrink-0 text-[10px] font-mono text-muted/70 bg-bgsoft border border-line/60 rounded-lg px-1 py-0.5">
              <button onClick={onPrevVersion} disabled={versionIndex === 0} className="disabled:opacity-30 hover:text-ink transition-colors" title="Önceki sürüm"><ChevronLeft size={13} /></button>
              {/* W1 — sürüm göstergesi artık TIKLANABİLİR. Eskiden yalnız ‹ ›
                 okları vardı: 5. sürümdeyken 1.'ye dönmek 4 tıklıyordu ve
                 hangi sürümde ne olduğunu görmenin yolu yoktu. */}
              {onSelectVersion ? (
                <button
                  onClick={() => setVersionListOpen((v) => !v)}
                  aria-expanded={versionListOpen}
                  title="Sürüm listesi"
                  className="px-0.5 hover:text-ink transition-colors"
                >
                  v{(versionIndex ?? 0) + 1}/{versionTotal}
                </button>
              ) : (
                <span>v{(versionIndex ?? 0) + 1}/{versionTotal}</span>
              )}
              <button onClick={onNextVersion} disabled={versionIndex === (versionTotal ?? 1) - 1} className="disabled:opacity-30 hover:text-ink transition-colors" title="Sonraki sürüm"><ChevronRight size={13} /></button>
              {versionListOpen && onSelectVersion && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-44 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface elev-2 py-1 font-sans">
                  {Array.from({ length: versionTotal ?? 0 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => { onSelectVersion(i); setVersionListOpen(false); }}
                      aria-current={i === versionIndex ? "true" : undefined}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                        i === versionIndex ? "bg-brand/10 text-brand font-semibold" : "text-ink/85 hover:bg-bgsoft/70"
                      }`}
                    >
                      <span className="font-mono text-[11px] shrink-0">v{i + 1}</span>
                      <span className="truncate text-muted/70">
                        {i === (versionTotal ?? 1) - 1 ? "en son" : i === 0 ? "ilk üretim" : "revizyon"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
          {onOpenInStudio && (
            <button
              onClick={onOpenInStudio}
              className={iconBtn}
              title="Stüdyo'da aç — tema, sürüm geçmişi ve gelişmiş düzenlemeyle devam et"
              aria-label="Stüdyo'da aç"
            ><Wand2 size={15} /></button>
          )}
          {/* U5 — cihaz önizlemesi. Yalnız görsel türlerde (html/svg) anlamlı:
             markdown/kod zaten metin akışı, telefon çerçevesine sokmak bilgi
             vermez. Önizleme sekmesi dışında da gizlenir. */}
          {showDevicePicker && view === "preview" && (artifact.type === "html" || artifact.type === "svg") && (
            <div className="hidden sm:flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 mr-1 shrink-0">
              {STUDIO_DEVICES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDeviceId(d.id)}
                  title={`${d.name} — ${d.width}px`}
                  aria-label={`${d.name} önizlemesi`}
                  aria-current={deviceId === d.id ? "true" : undefined}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    deviceId === d.id ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"
                  }`}
                >
                  {d.phone ? <Smartphone size={13} /> : <Monitor size={13} />}
                </button>
              ))}
            </div>
          )}
          <button onClick={copySource} className={iconBtn} title="Kaynağı kopyala">{copied ? <Check size={15} className="text-brand" /> : <Copy size={15} />}</button>
          <ExportMenu
            triggerLabel="Dışa aktar"
            busy={publishing}
            options={[
              { key: "download", label: "İndir", icon: <Download size={14} />, onSelect: download },
              { key: "publish", label: "Yayınla (bağlantı)", icon: <Link2 size={14} />, onSelect: publish },
              { key: "github", label: "GitHub'a gönder (yeni depo)", icon: <GitBranch size={14} />, onSelect: openGithubExport },
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
          {/* W3 — sunum modu. "Büyüt" uygulama kromunu (araç çubuğu, notlar)
             KORUYOR; sunum/tasarım göstermek için kromsuz bir görünüm gerekli. */}
          {enablePresent && view === "preview" && (artifact.type === "html" || artifact.type === "svg") && (
            <button onClick={() => setPresenting(true)} className={iconBtn} title="Sunum modu (tam ekran, kromsuz — Esc ile çık)" aria-label="Sunum modu">
              <Presentation size={15} />
            </button>
          )}
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

      {ghAsking && ghUrl && (
        /* Sonuç satırı — gönderim bitince form yerine bu kalır. Kısmi hata
           durumunda (depo açıldı, dosya yazılamadı) da gösterilir: kullanıcı
           boş depoyu görebilmeli, çünkü tekrar denerse "ad zaten var" alır. */
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-line bg-brand/5 text-[11px]">
          <GitBranch size={12} className="text-brand shrink-0" />
          <span className="text-muted shrink-0">Depo:</span>
          <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate min-w-0 flex-1 font-semibold">{ghUrl.replace(/^https?:\/\//, "")}</a>
          <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-brand hover:underline font-semibold">Depoyu aç ↗</a>
          <button onClick={() => { setGhAsking(false); setGhUrl(null); }} className="shrink-0 text-muted hover:text-ink font-semibold transition-colors">Kapat</button>
        </div>
      )}

      {ghAsking && !ghUrl && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-line bg-brand/5 text-[11px]">
          <GitBranch size={12} className="text-brand shrink-0" />
          <input
            value={ghName}
            onChange={(e) => setGhName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void exportToGithub(); if (e.key === "Escape") setGhAsking(false); }}
            placeholder="depo-adi"
            disabled={ghBusy}
            aria-label="Yeni depo adı"
            className="min-w-[120px] flex-1 bg-surface border border-line rounded-md px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-brand/50"
          />
          <label className="flex items-center gap-1 text-muted cursor-pointer select-none">
            <input type="checkbox" checked={ghPrivate} onChange={(e) => setGhPrivate(e.target.checked)} disabled={ghBusy} />
            Özel
          </label>
          <button onClick={() => void exportToGithub()} disabled={ghBusy || !repoSlug(ghName, "")} className="shrink-0 px-2.5 py-1 rounded-md bg-brand text-[#111110] font-semibold disabled:opacity-40 transition-colors">
            {ghBusy ? "Gönderiliyor…" : "Oluştur ve gönder"}
          </button>
          <button onClick={() => setGhAsking(false)} disabled={ghBusy} className="shrink-0 text-muted hover:text-ink font-semibold transition-colors">Vazgeç</button>
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
            <span className="font-semibold text-ink/80">
              {qualityNotes.length === 1 ? "Kalite notu: " : `${qualityNotes.length} kalite notu: `}
            </span>
            {qualityNotes.join(" · ")}
          </span>
          {/* W2 — not artık salt-bilgi değil: tek tıkla modele geri gönderilip
             düzelttirilebiliyor. Lint zaten çalışıyordu ama kullanıcıya
             "şimdi ne yapayım?" sorusunu bırakıyordu. */}
          {onFixQuality && (
            <button
              onClick={() => onFixQuality(qualityNotes)}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand/15 text-brand font-semibold hover:bg-brand/25 transition-colors"
              title="Bu notları modele gönder ve düzelttir"
            >
              <Wand2 size={11} /> Düzelt
            </button>
          )}
        </div>
      )}

      <div className={`flex-1 min-h-0 ${framed ? "" : "bg-white"}`}>
        {view === "preview" ? (
          /* Cihaz çerçevesi seçiliyse iframe DeviceFrame'in içine sarılır —
             iframe'in kendisi (ref/key/sandbox) burada kalır, çerçeve yalnız
             genişliği ve kromu verir (bkz. DeviceFrame yorumu). */
          framed ? <DeviceFrame device={device}>{previewFrame}</DeviceFrame> : previewFrame
        ) : (
          <pre className="w-full h-full overflow-auto m-0 p-4 text-[12px] leading-relaxed font-mono bg-codebg text-[#d6d6d6]"><code>{artifact.content}</code></pre>
        )}
      </div>

      {/* W3 — Sunum modu katmanı. Kendi iframe'ini kurar (ana önizlemeyi
         söküp takmadan) — burada annotation/ref gerekmiyor, salt görüntüleme.
         Çıkış düğmesi yalnız fare hareketinde belirir (hover), böylece
         sunum sırasında ekranda hiçbir krom durmaz. */}
      {presenting && (
        <div className="fixed inset-0 z-[100] bg-black">
          <iframe
            srcDoc={baseSrcdoc}
            sandbox="allow-scripts allow-modals"
            allow=""
            referrerPolicy="no-referrer"
            className="w-full h-full border-0 bg-white"
            title="Sunum"
          />
          <button
            onClick={() => setPresenting(false)}
            title="Sunumdan çık (Esc)"
            aria-label="Sunumdan çık"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/45 text-white/80 backdrop-blur-sm grid place-items-center opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
