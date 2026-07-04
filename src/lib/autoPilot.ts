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
    /* Döviz / değerli metal / kripto / borsa — canlı veri gerektirir (kaç/ne kadar). */
    || /\b(dolar|euro|avro|sterlin|\$|€|£)\b/.test(t)
    || /\b(gram altın|çeyrek altın|tam altın|gram gümüş|ons)\b/.test(t)
    || /\b(bitcoin|btc|ethereum|eth|kripto|dogecoin|solana)\b/.test(t)
    || /\b(borsa|bist|nasdaq|hisse|faiz|enflasyon)\b/.test(t)
    || /\b(kaç (tl|lira|dolar|euro)|ne kadar (tl|lira|dolar|euro))\b/.test(t)
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

/* Stüdyo için otomatik çıktı türü (skill) seçimi — brief'ten. Open Design/
   Claude Design sadeliği: kullanıcı tür seçmek ZORUNDA değil; sistem anlar.
   Belirgin sinyal yoksa null döner → çağıran "landing" varsayılanını kullanır. */
export function autoStudioSkill(brief: string): string | null {
  const t = (brief || "").toLowerCase();
  if (!t.trim()) return null;
  const rules: [RegExp, string][] = [
    [/\b(sunum|slayt|deck|prezentasyon|pitch)\b/, "deck"],
    [/\b(e-?posta|mail|bülten|newsletter)\b/, "email"],
    [/\b(sosyal|instagram|post|afiş|banner|story)\b/, "social"],
    [/\b(dashboard|panel|gösterge|analitik ekran)\b/, "dashboard"],
    [/\b(tablo|table|liste görünümü)\b/, "table"],
    [/\b(bileşen|component|kart tasarımı|form tasarımı|buton seti)\b/, "component"],
    [/\b(fiyat|pricing|paket|abonelik sayfası)\b/, "pricing"],
    [/\b(blog|makale|yazı sayfası|article)\b/, "blog"],
    [/\b(portfolyo|portfolio|özgeçmiş|cv sitesi)\b/, "portfolio"],
    [/\b(404|hata sayfası|boş durum|empty state)\b/, "error"],
    [/\b(giriş|login|kayıt|signup|auth)\b/, "auth"],
    [/\b(onboarding|karşılama akışı|tanıtım turu)\b/, "onboarding"],
    [/\b(ayarlar ekranı|settings)\b/, "settings"],
    [/\b(mobil uygulama|app ekranı|telefon ekranı)\b/, "mobile"],
    [/\b(kurumsal site|çok sayfalı site|web sitesi)\b/, "marketing"],
    [/\b(landing|açılış sayfası|tanıtım sayfası|hero)\b/, "landing"],
    /* Akademik & araştırma çıktı türleri */
    [/\b(akademik poster|bilimsel poster|araştırma posteri|poster)\b/, "poster"],
    [/\b(araştırma özeti|proje özeti|one[- ]?pager|tek sayfa(lık)? özet)\b/, "onepager"],
    [/\b(sertifika|katılım belgesi|başarı belgesi|certificate|diploma)\b/, "certificate"],
  ];
  for (const [re, id] of rules) if (re.test(t)) return id;
  return null;
}
