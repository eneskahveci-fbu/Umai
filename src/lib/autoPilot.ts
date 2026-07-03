/* Otomatik Pilot — "görünmez zeka" karar beyni. Kullanıcı hiçbir mod çipiyle
   uğraşmadan, mesajın kendisinden eforu, web aramayı, derin araştırmayı,
   kalite modunu ve ajan ekibini SEÇER. Saf fonksiyonlar → birim testli.
   (autoEffort/autoSwarm CoderView'dan buraya taşındı — tek kaynak.) */

export type Effort = "low" | "medium" | "high" | "max";

export interface PilotDecision {
  effort: Effort;
  /** Güncel bilgi sinyali → web araması bağlamı. */
  web: boolean;
  /** Çok kaynaklı derin rapor isteği → /api/research hattı. */
  research: boolean;
  /** Taslak→öz-eleştiri→düzeltme (ortalama modeli zekileştirir). */
  quality: boolean;
  /** Çok parçalı ağır iş → ajan ekibi (planlayıcı+paralel işçiler). */
  swarm: boolean;
  /** Durum rozeti tooltip'i için kısa Türkçe etiketler. */
  reasons: string[];
}

/* Otomatik düşünme eforu: kısa/basit → düşük-orta; uzun/kod/ağır anahtar
   kelime → yüksek; "kapsamlı/derinlemesine" → max. */
export function autoEffort(text: string): Effort {
  const t = (text || "").trim();
  const len = t.length;
  if (/derinlemesine|kapsamlı|baştan (yaz|kur)|comprehensive|in.?depth/i.test(t)) return "max";
  if (
    len > 280 ||
    /```/.test(t) ||
    /\b(refactor|optimi|debug|implement|mimari|architect|algorithm|performans|g[üu]venlik|security|migrate|taşı|tasarla|yeniden yaz)\b/i.test(t)
  ) return "high";
  if (len < 36 && !/\?/.test(t)) return "low";
  return "medium";
}

/* Otomatik Ajan Ekibi: yalnızca AÇIKÇA çok-parçalı/çok-adımlı ağır isteklerde
   true (maliyet/sürpriz olmasın diye temkinli eşik; kısa istek → tek ajan). */
export function autoSwarm(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 120) return false;
  const listItems = (t.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) || []).length;
  if (listItems >= 3) return true;
  const verbs = (t.toLowerCase().match(/\b(ekle|oluştur|yaz|düzenle|refactor|kur|taşı|sil|güncelle|test et|implement|build)\b/g) || []).length;
  if (verbs >= 4 && t.length > 280) return true;
  if (/(her .{2,30} için|tüm .{2,40}(?:ler|lar))/i.test(t) && t.length > 200) return true;
  return false;
}

/* Güncellik sinyali: bugünün bilgisi/haber/fiyat/sürüm sorusu → web bağlamı.
   Temkinli: kod/genel bilgi sorularında tetiklenmez. */
export function autoWeb(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (t.length < 8) return false;
  if (/```/.test(t)) return false; // kod odaklı istek — web gereksiz
  return /\b(güncel|bugün|şu an(da)?|son (sürüm|dakika|haber)|en yeni|fiyat[ıi]?|kur[uu]?|haber|hava (durumu|nasıl)|kim kazandı|ne zaman çık|piyasa|döviz|maç|skor)\b/.test(t)
    || (/\b20(2[4-9]|3\d)\b/.test(t) && /\?/.test(t));
}

/* Derin araştırma: açıkça çok kaynaklı/kapsamlı rapor isteği. */
export function autoResearch(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (t.length < 60) return false;
  return /\b(derinlemesine araştır|kapsamlı (bir )?(rapor|araştırma|analiz)|karşılaştırmalı (analiz|rapor|inceleme)|literatür|kaynaklarıyla|kaynak göstererek|detaylı araştır)\b/.test(t);
}

/* Kalite modu: yüksek nitelik beklenen üretim işlerinde taslak→eleştiri→düzelt. */
export function autoQuality(text: string, effort: Effort): boolean {
  const t = (text || "").trim();
  if (effort === "max") return true;
  return t.length > 400 && /\b(rapor|makale|doküman|dokümantasyon|tasarla|planla|öneri|strateji)\b/i.test(t);
}

/** Tek karar noktası — CoderView gönderim anında çağırır. */
export function decidePilot(text: string, ctx: { hasRepo: boolean }): PilotDecision {
  const effort = autoEffort(text);
  const research = autoResearch(text);
  const web = research || autoWeb(text);
  const quality = autoQuality(text, effort);
  const swarm = ctx.hasRepo && autoSwarm(text);
  const reasons: string[] = [];
  const effortLabel: Record<Effort, string> = { low: "hızlı", medium: "dengeli", high: "yüksek efor", max: "maksimum efor" };
  reasons.push(effortLabel[effort]);
  if (web && !research) reasons.push("web");
  if (research) reasons.push("derin araştırma");
  if (quality) reasons.push("kalite turu");
  if (swarm) reasons.push("ajan ekibi");
  return { effort, web, research, quality, swarm, reasons };
}
