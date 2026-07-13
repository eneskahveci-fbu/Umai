/* Anket yanıt analitiği — merkezî toplanan yanıtların (form_responses tablosu)
   soru bazında özetlenmesi. Saf fonksiyonlar: UI'dan ve Supabase'den bağımsız,
   birim test edilebilir. Yanıt satırı, dışa aktarılan HTML'in gönderdiği
   şekildedir: sorularla AYNI SIRADA string dizisi (multi seçimler " | " ile
   birleşik — bkz. forms.ts submit toplayıcısı). */
import type { CraftForm, FormQuestion } from "./types";

export interface FormResponseRow {
  /** jsonb — string[] beklenir ama dış veri: her erişim korumalı. */
  answers: unknown;
  created_at: string;
}

export interface OptionCount {
  value: string;
  count: number;
}

export interface QuestionSummary {
  question: FormQuestion;
  /** Boş olmayan yanıt sayısı. */
  answered: number;
  /** choice/dropdown/multi/rating: değer → adet (tanımlı seçenekler 0'la da listelenir). */
  counts?: OptionCount[];
  /** rating: 1-5 ortalaması (answered=0 iken undefined). */
  average?: number;
  /** short/long/date: en yeni örnek yanıtlar (sıra: verilen satır sırası). */
  samples?: string[];
}

/** Dışa aktarılan HTML'in çoklu seçimleri birleştirdiği ayraç. */
const MULTI_SEP = " | ";
const MAX_SAMPLES = 8;

function answerAt(row: FormResponseRow, i: number): string {
  if (!Array.isArray(row.answers)) return "";
  const v = (row.answers as unknown[])[i];
  return typeof v === "string" ? v : "";
}

function countValues(values: string[], declared: string[]): OptionCount[] {
  const map = new Map<string, number>();
  for (const d of declared) map.set(d, 0);
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([value, count]) => ({ value, count }));
}

export function summarizeResponses(form: CraftForm, rows: FormResponseRow[]): QuestionSummary[] {
  return form.questions.map((question, i) => {
    const values = rows.map((r) => answerAt(r, i)).filter((v) => v.trim() !== "");
    const s: QuestionSummary = { question, answered: values.length };
    switch (question.type) {
      case "choice":
      case "dropdown":
        s.counts = countValues(values, question.options ?? []);
        break;
      case "multi":
        s.counts = countValues(values.flatMap((v) => v.split(MULTI_SEP)).filter(Boolean), question.options ?? []);
        break;
      case "rating": {
        s.counts = countValues(values, ["1", "2", "3", "4", "5"]);
        const nums = values.map(Number).filter((n) => Number.isFinite(n));
        if (nums.length) s.average = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
        break;
      }
      default:
        s.samples = values.slice(0, MAX_SAMPLES);
    }
    return s;
  });
}

/** Merkezî yanıtları CSV'ye çevirir (dışa aktarılan HTML'in yerel CSV'siyle
    aynı düzen: Zaman + soru başlıkları). BOM: Excel Türkçe karakter uyumu. */
export function responsesToCsv(form: CraftForm, rows: FormResponseRow[]): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [["Zaman", ...form.questions.map((q) => q.label)].map(esc).join(",")];
  for (const r of rows) {
    lines.push([r.created_at, ...form.questions.map((_, i) => answerAt(r, i))].map(esc).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}
