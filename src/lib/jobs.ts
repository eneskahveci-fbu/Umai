/* Görev Kuyruğu (Otonom Ajan motoru) — saf tipler ve yardımcılar.
   Kullanıcı bir hedefi "arka planda çalıştır" der; iş kuyruğa girer, uygulama
   AÇIKKEN (herhangi bir yüzeyde) sırayla çalışır, bitince bildirim gelir.
   Buradaki her şey SAF (React/DOM yok) → birim testli. Çalıştırıcı ve UI
   ayrı (BackgroundJobs.tsx). */

export type JobStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface JobStep {
  /** Adım metni (plan maddesi ya da ilerleme notu). */
  text: string;
  at: number;
}

export interface BackgroundJob {
  id: string;
  /** Kullanıcının verdiği ham hedef. */
  goal: string;
  /** Kısa, insan-okur başlık (hedeften türetilir). */
  title: string;
  status: JobStatus;
  /** Canlı ilerleme adımları (plan + notlar). */
  steps: JobStep[];
  /** Tamamlanınca nihai metin sonucu. */
  result?: string;
  /** Hata durumunda mesaj. */
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** Hedeften kısa, temiz bir başlık türetir (≤60 karakter, tek satır). */
export function deriveJobTitle(goal: string): string {
  const first = (goal || "").trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
  if (!first) return "Görev";
  return first.length > 60 ? first.slice(0, 57).trimEnd() + "…" : first;
}

/** Kuyrukta çalışmayı bekleyen İLK işi döndürür (yoksa null). Aynı anda tek iş
    çalışır: zaten "running" bir iş varsa yenisini başlatma. */
export function nextRunnableJob(jobs: BackgroundJob[]): BackgroundJob | null {
  if (jobs.some((j) => j.status === "running")) return null;
  return jobs.find((j) => j.status === "queued") ?? null;
}

export interface JobCounts { queued: number; running: number; done: number; error: number; active: number; total: number; }

/** Panel rozeti için özet sayımlar. `active` = queued + running. */
export function jobCounts(jobs: BackgroundJob[]): JobCounts {
  const c: JobCounts = { queued: 0, running: 0, done: 0, error: 0, active: 0, total: jobs.length };
  for (const j of jobs) {
    if (j.status === "queued") c.queued++;
    else if (j.status === "running") c.running++;
    else if (j.status === "done") c.done++;
    else if (j.status === "error") c.error++;
  }
  c.active = c.queued + c.running;
  return c;
}

/** Bir işe ilerleme adımı ekler (immutable). */
export function withStep(job: BackgroundJob, text: string, at: number): BackgroundJob {
  const t = text.trim();
  if (!t) return job;
  /* Aynı metni art arda tekrarlama (akış gürültüsü). */
  if (job.steps.length && job.steps[job.steps.length - 1].text === t) return job;
  return { ...job, steps: [...job.steps, { text: t, at }].slice(-30), updatedAt: at };
}

/* Otonom ajan sistem promptu: modele önce KISA bir plan, sonra işi bitirmesini
   söyler. Araçsız (Faz 1) — saf üretim/araştırma/yazım hedefleri için. */
export const JOB_SYSTEM =
  "Sen Craft'ın otonom görev ajanısın. Kullanıcı sana bir HEDEF verdi ve arka " +
  "planda, tek seferde bitirmeni bekliyor — ara soru sorma, onay bekleme.\n\n" +
  "Çalışma biçimi:\n" +
  "1) Önce '## Plan' başlığı altında 2-5 maddelik KISA bir yapılacaklar listesi yaz.\n" +
  "2) Sonra '## Sonuç' başlığı altında hedefi EKSİKSİZ, kullanıma hazır biçimde tamamla " +
  "(taslak değil, nihai çıktı: metin/tablo/kod ne gerekiyorsa).\n" +
  "3) Uydurma bilgi/kaynak verme; emin olmadığın yeri açıkça belirt.\n" +
  "Türkçe ve net yaz. Gereksiz dolgu yapma.";

/** İş çalıştırmak için LLM'e gidecek tek kullanıcı mesajını kurar. */
export function buildJobMessages(goal: string): { role: "user"; content: string }[] {
  return [{ role: "user", content: goal.trim() }];
}

/** Akan tam metinden son "## ..." başlığını canlı adım olarak çıkarır (ilerleme
    hissi). Başlık yoksa null. Saf → testli. */
export function latestHeading(fullText: string): string | null {
  const matches = (fullText || "").match(/^\s{0,3}#{1,6}\s+(.+)$/gm);
  if (!matches || !matches.length) return null;
  return matches[matches.length - 1].replace(/^\s*#+\s+/, "").trim() || null;
}
