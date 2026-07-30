/* Model çıktısından JSON ayıklama — SAF ayrıştırma, ağ yok.

   genChat.ts'ten (taşıma katmanı) ayrı tutulur: böylece motorların testleri
   `vi.mock("../genChat")` ile ağ çağrısını taklit ederken bu gerçek
   ayrıştırıcıyı kullanmaya devam eder. (Mock fabrikasında `importOriginal`
   kullanmak vitest'te iki adım derinlikteki modüllere sızmıyor; sorumlulukları
   ayırmak hem mimari olarak doğru hem de bu tuzağı tamamen ortadan kaldırıyor.) */
import { ModelOutputError } from "./friendlyError";

/** Modelin gerçekte ne döndürdüğünü gösteren kısa örnek — studioExtract.ts'in
    `failureMessage`'ıyla AYNI biçim (160 karakter, boşluklar sadeleştirilmiş). */
function sampleOf(text: string): string {
  const t = (text || "").trim().replace(/\s+/g, " ");
  return t.length > 160 ? `${t.slice(0, 160)}…` : t;
}

/** Yanıttan ilk dengeli { } JSON bloğunu ayıklar (```json çitleri desteklenir). */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  /* Dürüst hata (Tem 2026 denetimi): eskiden yalnız "JSON bulunamadı — tekrar
     dene." deniyordu; kullanıcı modelin aslında ne yaptığını (düz metinle
     cevap verdi mi, hiç yanıt vermedi mi) göremiyordu. Artık boş yanıt ile
     "konuştu ama JSON vermedi" ayrımı yapılıp modelin metni alıntılanıyor —
     studioExtract.ts'teki HTML yolunun AYNI deseni. */
  if (start === -1) {
    throw new ModelOutputError(
      text.trim()
        ? `Model JSON yerine düz metin döndürdü. Modelin yanıtı: "${sampleOf(text)}"`
        : "Model boş yanıt döndürdü. Başka bir model dene (Ayarlar → Model) ya da tekrar gönder.",
      text,
    );
  }
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new ModelOutputError(
    `Modelin JSON çıktısı yarıda kesildi (muhtemelen token sınırı). Başlangıcı: "${sampleOf(src)}"`,
    text,
  );
}
