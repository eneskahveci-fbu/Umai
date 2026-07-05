"use client";

/* Görev Kuyruğu — Otonom Ajan'ın yüzen panosu + çalıştırıcısı.
   Kullanıcı "arka planda çalıştır" der → iş kuyruğa girer. Bu bileşen /app'te
   TEK kez mount edilir: kuyruğu sırayla işler (streamChat ile), ilerlemeyi
   canlı gösterir, bitince ses + bildirim verir. Uygulama AÇIKKEN çalışır
   (herhangi bir yüzeyde); sekme kapanırsa iş yenilemede tekrar kuyruğa döner. */

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Copy, Loader2, MessageSquarePlus, Trash2, X, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { streamChat } from "@/lib/genChat";
import { playReady, playError, notifyReady } from "@/lib/sounds";
import { JOB_SYSTEM, buildJobMessages, nextRunnableJob, jobCounts, latestHeading, type BackgroundJob } from "@/lib/jobs";

/* ── Çalıştırıcı: kuyruktaki işleri sırayla yürütür ────────────────────── */
function useJobRunner() {
  const jobs = useStore((s) => s.backgroundJobs);
  const updateJob = useStore((s) => s.updateJob);
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    const next = nextRunnableJob(jobs);
    if (!next) return;

    runningRef.current = true;
    const id = next.id;
    updateJob(id, { status: "running", steps: [{ text: "Başlatılıyor…", at: Date.now() }] });

    (async () => {
      try {
        let lastHeading = "";
        const full = await streamChat({
          system: JOB_SYSTEM,
          messages: buildJobMessages(next.goal),
          temperature: 0.6,
          onDelta: (text) => {
            const h = latestHeading(text);
            if (h && h !== lastHeading) {
              lastHeading = h;
              /* En güncel işi store'dan al (bayat closure önlenir). */
              const cur = useStore.getState().backgroundJobs.find((j) => j.id === id);
              if (cur) updateJob(id, { steps: [...cur.steps, { text: h, at: Date.now() }].slice(-30) });
            }
          },
        });
        const clean = full.trim();
        if (!clean) {
          updateJob(id, { status: "error", error: "Model boş yanıt döndürdü." });
          playError();
        } else {
          updateJob(id, { status: "done", result: clean });
          playReady();
          const title = useStore.getState().backgroundJobs.find((j) => j.id === id)?.title ?? "Görev";
          void notifyReady("✓ Görev tamamlandı", title);
        }
      } catch (e) {
        const msg = (e as Error)?.name === "AbortError" ? "İptal edildi." : ((e as Error).message || "bilinmeyen hata");
        updateJob(id, { status: (e as Error)?.name === "AbortError" ? "canceled" : "error", error: msg });
        if ((e as Error)?.name !== "AbortError") playError();
      } finally {
        runningRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);
}

/* ── Tek iş satırı ─────────────────────────────────────────────────────── */
function JobRow({ job, onRemove }: { job: BackgroundJob; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const addToast = useStore((s) => s.addToast);
  const newChat = useStore((s) => s.newChat);
  const pushMessage = useStore((s) => s.pushMessage);
  const persistCurrent = useStore((s) => s.persistCurrent);
  const nav = useSurfaceNav();

  const lastStep = job.steps[job.steps.length - 1]?.text;
  const StatusIcon =
    job.status === "running" ? <Loader2 size={13} className="animate-spin text-brand shrink-0" /> :
    job.status === "queued" ? <span className="w-[13px] h-[13px] rounded-full border border-line shrink-0" /> :
    job.status === "done" ? <Check size={13} className="text-green shrink-0" /> :
    job.status === "error" ? <AlertTriangle size={13} className="text-red shrink-0" /> :
    <X size={13} className="text-muted shrink-0" />;

  const openAsChat = () => {
    if (!job.result) return;
    newChat(false);
    pushMessage({ role: "user", content: job.goal });
    pushMessage({ role: "assistant", content: job.result });
    void persistCurrent();
    nav.close();
    addToast("Görev sonucu sohbete açıldı.", "success");
  };

  return (
    <div className="rounded-xl border border-line/70 bg-bgsoft/60">
      <button
        onClick={() => (job.status === "done" || job.status === "error") && setOpen((v) => !v)}
        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left ${(job.status === "done" || job.status === "error") ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="mt-0.5">{StatusIcon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-ink/90 truncate">{job.title}</span>
          <span className="block text-[11px] text-muted/70 truncate">
            {job.status === "queued" ? "Sırada bekliyor…" :
             job.status === "running" ? (lastStep || "Çalışıyor…") :
             job.status === "done" ? "Tamamlandı — aç" :
             job.status === "error" ? (job.error || "Hata") : "İptal"}
          </span>
        </span>
        {(job.status === "done" || job.status === "error") && (
          <ChevronDown size={14} className={`text-muted/50 shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(job.id); }}
          className="text-muted/40 hover:text-red p-0.5 shrink-0 mt-0.5"
          title="Kaldır"
        ><Trash2 size={12} /></button>
      </button>

      {open && job.status === "done" && job.result && (
        <div className="px-3 pb-3">
          <div className="max-h-52 overflow-y-auto no-scrollbar rounded-lg border border-line/60 bg-surface p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap text-ink/85">
            {job.result}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(job.result || ""); addToast("Sonuç kopyalandı.", "success"); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-line hover:border-brand/40 text-muted hover:text-ink transition-colors"
            ><Copy size={12} /> Kopyala</button>
            <button
              onClick={openAsChat}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-brand/15 border border-brand/30 text-brand hover:bg-brand/20 transition-colors"
            ><MessageSquarePlus size={12} /> Sohbete aç</button>
          </div>
        </div>
      )}
      {open && job.status === "error" && (
        <div className="px-3 pb-3 text-[11px] text-red/80 break-words">{job.error}</div>
      )}
    </div>
  );
}

/* ── Yüzen pano ────────────────────────────────────────────────────────── */
export function BackgroundJobs() {
  useJobRunner();
  const jobs = useStore((s) => s.backgroundJobs);
  const removeJob = useStore((s) => s.removeJob);
  const clearFinishedJobs = useStore((s) => s.clearFinishedJobs);
  const [open, setOpen] = useState(false);

  const counts = jobCounts(jobs);
  if (jobs.length === 0) return null;

  const hasFinished = counts.done + counts.error > 0;

  return (
    <>
      {/* Tetik butonu — mobil alt çubuğun ÜSTÜnde (sağ alt). */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-3 z-[60] bottom-[calc(var(--surface-pb,12px)+12px)] sm:bottom-4 flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-full glass border border-line shadow-lg shadow-black/30 text-sm"
        title="Arka plan görevleri"
      >
        <Bot size={16} className={`text-brand ${counts.running > 0 ? "animate-breathe" : ""}`} />
        <span className="font-semibold text-ink/90">{counts.active > 0 ? `${counts.active} görev` : "Görevler"}</span>
        {counts.running > 0 && <Loader2 size={13} className="animate-spin text-brand" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed right-3 z-[61] bottom-[calc(var(--surface-pb,12px)+60px)] sm:bottom-16 w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface elev-3 flex flex-col max-h-[70vh]">
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line/60 shrink-0">
              <Bot size={15} className="text-brand" />
              <span className="text-sm font-bold">Arka plan görevleri</span>
              <span className="text-[11px] text-muted/60">{counts.active} aktif</span>
              {hasFinished && (
                <button onClick={clearFinishedJobs} className="ml-auto text-[11px] text-muted/60 hover:text-ink transition-colors">Bitenleri temizle</button>
              )}
              <button onClick={() => setOpen(false)} className={`${hasFinished ? "" : "ml-auto"} text-muted/50 hover:text-ink p-0.5`}><X size={15} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-2.5 flex flex-col gap-2">
              {jobs.map((j) => <JobRow key={j.id} job={j} onRemove={removeJob} />)}
            </div>
            <div className="px-3.5 py-2 border-t border-line/50 text-[10px] text-muted/50 shrink-0 leading-snug">
              Görevler uygulama açıkken çalışır. Sekmeyi kapatırsan yarım kalan iş, geri döndüğünde kaldığı yerden sürer.
            </div>
          </div>
        </>
      )}
    </>
  );
}
