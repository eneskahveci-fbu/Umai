"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, Download, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalA11y } from "@/lib/useModalA11y";
import { useExitAnimation } from "@/lib/useExitAnimation";
import type { CraftForm } from "@/lib/types";
import { responsesToCsv, summarizeResponses, type FormResponseRow } from "@/lib/formAnalytics";
import { safeFileName } from "./DocsStudio";

/* Anket merkezî yanıt özeti — form sahibinin (RLS) form_responses'tan
   çektiği yanıtların soru bazında dökümü. Veri YOKKEN de yol gösterir:
   merkezî toplama yalnız girişliyken yayınlanan/indirilen formlarda açılır. */
export function FormResponsesModal({ form, open, onClose }: {
  form: CraftForm;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalA11y(ref, open, onClose);

  const [rows, setRows] = useState<FormResponseRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* Modal artık kapanış animasyonu oynayabilsin diye `form` var oldukça mounted
     kalır (bkz. FormsStudio.tsx) — bu yüzden her açılışta state'i burada elle
     tazeleriz (eskiden tam unmount/remount bunu bedavaya veriyordu). */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setRows(null);
      setErr(null);
      const sb = createClient();
      if (!sb) { if (alive) setErr("Supabase yapılandırılmamış."); return; }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { if (alive) setErr("Merkezî yanıtları görmek için giriş yapmalısın."); return; }
      let { data, error } = await sb
        .from("form_responses")
        .select("answers, question_ids, created_at")
        .eq("form_id", form.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      /* Geriye uyumluluk: question_ids kolonu henüz migrate edilmemiş bir
         Supabase kurulumunda sorgu TÜMÜYLE kırılmasın — kolon-yok hatasında
         onsuz yeniden dene (yalnız eski pozisyonel eşleme kullanılır, veri
         akışı durmaz). */
      if (error && /question_ids/i.test(error.message)) {
        const fallback = await sb
          .from("form_responses")
          .select("answers, created_at")
          .eq("form_id", form.id)
          .order("created_at", { ascending: false })
          .limit(1000);
        data = fallback.data?.map((r) => ({ ...r, question_ids: null })) ?? null;
        error = fallback.error;
      }
      if (!alive) return;
      if (error) {
        setErr(/does not exist|relation/i.test(error.message)
          ? "Supabase şeması güncel değil — supabase/schema.sql'deki Anket bölümünü SQL Editor'de çalıştır."
          : error.message);
      } else setRows((data ?? []) as FormResponseRow[]);
    })();
    return () => { alive = false; };
  }, [open, form.id]);

  const { mounted, closing } = useExitAnimation(open);
  if (!mounted) return null;

  const summaries = rows ? summarizeResponses(form, rows) : [];

  const downloadCsv = () => {
    if (!rows?.length) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([responsesToCsv(form, rows)], { type: "text/csv;charset=utf-8" }));
    a.download = `${safeFileName(form.title, "anket")}-yanitlar.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className={`fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 ${closing ? "animate-modal-bg-out" : "animate-modal-bg"}`} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-sm font-bold flex items-center gap-1.5 min-w-0">
            <BarChart3 size={14} className="text-brand shrink-0" />
            <span className="truncate">Yanıtlar{rows ? ` — ${rows.length}` : ""}</span>
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {!!rows?.length && (
              <button onClick={downloadCsv} title="Merkezî yanıtları CSV indir" className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-brand" aria-label="Merkezî yanıtları CSV indir">
                <Download size={14} />
              </button>
            )}
            <button onClick={onClose} aria-label="Kapat" className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink"><X size={14} /></button>
          </div>
        </div>

        {err && <p className="text-xs text-red">{err}</p>}
        {!err && rows === null && (
          <p className="text-xs text-muted flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Yanıtlar yükleniyor…</p>
        )}
        {rows?.length === 0 && (
          <p className="text-xs text-muted leading-relaxed">
            Henüz merkezî yanıt yok. Girişliyken <strong>Yayınla</strong> (veya HTML indir) ile paylaştığın form,
            doldurulan her yanıtı buraya iletir — form ayrıca sunucusuz (cihaz içi CSV) çalışmaya devam eder.
          </p>
        )}

        {!!rows?.length && summaries.map((s) => (
          <div key={s.question.id} className="rounded-xl border border-line/60 p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xs font-semibold min-w-0 truncate">{s.question.label}</div>
              <div className="text-[11px] text-muted/60 shrink-0">
                {s.answered} yanıt{s.average !== undefined ? ` · ort. ${s.average}` : ""}
              </div>
            </div>
            {s.counts && (
              <div className="space-y-1">
                {s.counts.map((c) => {
                  const max = Math.max(1, ...s.counts!.map((x) => x.count));
                  return (
                    <div key={c.value} className="flex items-center gap-2 text-[11px]">
                      <span className="w-28 shrink-0 truncate text-muted" title={c.value}>{c.value}</span>
                      <div className="flex-1 h-2 rounded-full bg-bgsoft overflow-hidden">
                        <div className="h-full bg-brand/70 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right tabular-nums text-muted/70">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {s.samples && (
              s.samples.length
                ? <ul className="space-y-0.5">{s.samples.map((v, i) => <li key={i} className="text-[11px] text-muted truncate">· {v}</li>)}</ul>
                : <p className="text-[11px] text-muted/50">Yanıt yok.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
