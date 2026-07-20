/* Anket yanıt analitiği — merkezî toplanan yanıtların (form_responses tablosu)
   soru bazında özetlenmesi. Saf fonksiyonlar: UI'dan ve Supabase'den bağımsız,
   birim test edilebilir. Yanıt satırı, dışa aktarılan HTML'in gönderdiği
   şekildedir: sorularla AYNI SIRADA string dizisi (multi seçimler " | " ile
   birleşik — bkz. forms.ts submit toplayıcısı). */
import type { CraftForm, FormQuestion } from "./types";

export interface FormResponseRow {
  /** jsonb — string[] beklenir ama dış veri: her erişim korumalı. */
  answers: unknown;
  /** Yanıt gönderilirken form.questions'ın O ANKİ sırasıyla aynı hizada
      soru id'leri — form sahibi YAYINDAN SONRA soru ekler/siler/sıralarsa
      answers'ın ham pozisyonu artık GÜNCEL form.questions ile uyuşmaz;
      bu alan doğru eşleştirmeyi sağlar. Eski satırlarda yok (geriye dönük
      uyum: pozisyonel varsayılır). */
  question_ids?: unknown;
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

/* `question`'ın bu satırdaki cevabını bulur. `question_ids` doluysa (yanıt bu
   düzeltmeden SONRA toplanmış) o anki soru id sırasına göre eşleşir — form
   sonradan düzenlense (soru eklenir/silinir/sıralanır) bile YANLIŞ sorunun
   cevabı gösterilmez; id bu satırda hiç yoksa (soru o an henüz yoktu) boş
   döner. `question_ids` yoksa (eski satır, geriye dönük uyum) pozisyonel `i`
   varsayılır — eski davranış korunur. */
function answerAt(row: FormResponseRow, question: FormQuestion, i: number): string {
  if (!Array.isArray(row.answers)) return "";
  const answers = row.answers as unknown[];
  if (Array.isArray(row.question_ids)) {
    const idx = (row.question_ids as unknown[]).indexOf(question.id);
    if (idx === -1) return "";
    const v = answers[idx];
    return typeof v === "string" ? v : "";
  }
  const v = answers[i];
  return typeof v === "string" ? v : "";
}

function countValues(values: string[], declared: string[]): OptionCount[] {
  const map = new Map<string, number>();
  for (const d of declared) map.set(d, 0);
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([value, count]) => ({ value, count }));
}

/* `joined`, seçilen seçeneklerin MULTI_SEP ile birleştirilmiş hâlidir (bkz.
   forms.ts). Naif `.split(MULTI_SEP)` bir seçenek METNİNİN KENDİSİ " | "
   içeriyorsa (ör. "Kahve | Çay" adlı tek bir seçenek) yanlış parçalara
   bölerdi — sayım gerçek seçimlerden SAPARDI. Bunun yerine `option`'ın
   `joined` içinde TAM BİR TOKEN olarak (baş/son veya iki ayraç arasında)
   geçip geçmediğini doğrudan sınar; asla bölme yapmaz, bu yüzden bir
   seçeneğin metninin başka bir seçeneğin ÖN EKİ olması durumunda da
   (ör. "Kırmızı" / "Kırmızı Koyu") yanlış pozitif vermez. */
function hasOptionToken(joined: string, option: string, sep: string): boolean {
  if (!option) return false;
  if (joined === option) return true;
  if (joined.startsWith(option + sep)) return true;
  if (joined.endsWith(sep + option)) return true;
  return joined.includes(sep + option + sep);
}

export function summarizeResponses(form: CraftForm, rows: FormResponseRow[]): QuestionSummary[] {
  return form.questions.map((question, i) => {
    const values = rows.map((r) => answerAt(r, question, i)).filter((v) => v.trim() !== "");
    const s: QuestionSummary = { question, answered: values.length };
    switch (question.type) {
      case "choice":
      case "dropdown":
        s.counts = countValues(values, question.options ?? []);
        break;
      case "multi": {
        /* .split(MULTI_SEP) YERİNE her bilinen seçeneği token olarak arar —
           bir seçeneğin metni ayracı içerse bile yanlış bölünmez (bkz.
           hasOptionToken). */
        const opts = question.options ?? [];
        s.counts = opts.map((opt) => ({
          value: opt,
          count: values.filter((v) => hasOptionToken(v, opt, MULTI_SEP)).length,
        }));
        break;
      }
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
    lines.push([r.created_at, ...form.questions.map((q, i) => answerAt(r, q, i))].map(esc).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}
