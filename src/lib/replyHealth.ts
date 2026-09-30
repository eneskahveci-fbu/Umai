/* Yanıt sağlığı — saf yardımcılar (testli).
   • looksDangling: model "Planı oluşturuyorum:" gibi bir giriş cümlesiyle
     bitirip durduysa (içerik yok, araç çağrısı yok) yanıt YARIM kalmıştır.
   • waitStage: bekleme metni gerçek geçen süreden türetilir, uydurulmaz. */

/** Kısa, iki nokta (":") ile biten ve kod çiti/liste içermeyen yanıt yarım kalmış sayılır. */
export function looksDangling(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 400) return false;
  if (t.includes("```")) return false;
  return /[:：]$/.test(t);
}

export interface WaitStage {
  label: string;
  /** Kullanıcıya "durdurup başka modeli dene" ipucu gösterilsin mi. */
  slow: boolean;
}

/** İlk parça gelene kadar geçen saniyeye göre bekleme aşaması. */
export function waitStage(elapsedSec: number, thinking: boolean): WaitStage {
  if (elapsedSec < 3) return { label: thinking ? "Düşünüyor" : "Yanıt hazırlanıyor", slow: false };
  if (elapsedSec < 10) return { label: thinking ? "Derin düşünüyor" : "Model çalışıyor", slow: false };
  if (elapsedSec < 25) return { label: "Model yavaş yanıt veriyor", slow: false };
  return { label: "Hâlâ bekleniyor", slow: true };
}
