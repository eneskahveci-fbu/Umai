/* Otomatik Pilot — "görünmez zeka" karar beyni. Kullanıcı hiçbir mod çipiyle
   uğraşmadan, mesajın kendisinden eforu, web aramayı, derin araştırmayı,
   kalite modunu ve ajan ekibini SEÇER. Saf fonksiyonlar → birim testli.
   (autoEffort/autoSwarm CoderView'dan buraya taşındı — tek kaynak.) */
import { trackEvent } from "./analytics";

export type Effort = "low" | "medium" | "high" | "max";

export interface PilotDecision {
  effort: Effort;
  /** Güncel bilgi sinyali → web araması bağlamı. */
  web: boolean;
  /** Çok kaynaklı derin rapor isteği → /api/research hattı. */
  research: boolean;
  /** Taslak→öz-eleştiri→düzeltme (ortalama modeli zekileştirir). */
  quality: boolean;
  /** Çoklu-model FÜZYON (3 taslak → hakem → sentez) — yalnız ÜRETİM işlerinde
      (site/uygulama/arayüz/kod üretimi). Normal sohbette çalışmaz. */
  fusion: boolean;
  /** Çok parçalı ağır iş → ajan ekibi (planlayıcı+paralel işçiler). */
  swarm: boolean;
  /** Doğal dilden görsel/resim isteği → generate_image aracı (Faz 6: repo
      bağlı olmasa bile bu TEK araç için tool-loop'u devreye sokar). */
  image: boolean;
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

/* Görsel üretim isteği. NOT: `\b` JS'te yalnız ASCII [A-Za-z0-9_]'yi "kelime
   karakteri" sayar — "çiz"/"üret" gibi Türkçe karaktere BAŞLAYAN kelimelerde
   boşluktan sonra hiç eşleşmez (iki taraf da \b'ye göre "kelime-dışı" kalır).
   Bu yüzden burada \b yerine \p{L} (Unicode harf) tabanlı özel sınır +
   gövdeye eklenen çekim eklerini yutan \p{L}* kullanılır ("çiz" → "çizer",
   "resim" → "resmi" gibi biçimleri de yakalar).
   Mantık: "çiz/draw/paint" gibi GÜÇLÜ (neredeyse yalnız görsel bağlamda
   kullanılan) fiiller TEK BAŞINA yeterli ("bana bir kedi çiz" — isim GEÇMEZ
   ama açık bir görsel isteğidir); "oluştur/yap/üret" gibi ZAYIF (kodlama
   isteklerinde de son derece yaygın) fiiller yalnız bir görsel-ortam ismiyle
   ("resim/görsel/logo/…") BİRLİKTE sayılır. Kod bağlamı ipucu varsa (bileşen/
   API/fonksiyon/dosya) hiç tetiklenmez — "logo bileşeni oluştur" muhtemelen
   bir kod isteğidir. Bu sinyal Faz 6'da YALNIZCA generate_image aracını repo
   bağlı olmayan düz sohbette de açar (bkz. CoderView.tsx'teki wantImageGen +
   api/chat/route.ts'in body.imageGen dalı) — deep_research/dispatch_agents
   hâlâ repo gerektirir. */
const IMG_CODE_CONTEXT = /(?<!\p{L})(bileşen|component|fonksiyon|function|değişken|variable|class|api|endpoint|route|dosya|file|kod)(?!\p{L})/iu;
const IMG_STRONG_VERB = /(?<!\p{L})(çiz\p{L}*|resmet\p{L}*|draw\p{L}*|paint\p{L}*|sketch\p{L}*|illustrate\p{L}*)(?!\p{L})/iu;
const IMG_NOUN = /(?<!\p{L})(res(?:im|m)\p{L}*|görsel\p{L}*|illüstrasyon\p{L}*|çizim\p{L}*|fotoğraf\p{L}*|foto\p{L}*|portre\p{L}*|karikatür\p{L}*|logo\p{L}*|afiş\p{L}*|manzara\p{L}*|duvar kağıdı\p{L}*|wallpaper|image|illustration|artwork|picture|drawing)(?!\p{L})/iu;
const IMG_WEAK_VERB = /(?<!\p{L})(üret\p{L}*|oluştur\p{L}*|tasarla\p{L}*|hazırla\p{L}*|göster\p{L}*|yap\p{L}*|create|generate|make)(?!\p{L})/iu;

export function autoImageGen(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 6) return false;
  if (/```/.test(t)) return false;
  if (IMG_CODE_CONTEXT.test(t)) return false;
  if (IMG_STRONG_VERB.test(t)) return true;
  return IMG_NOUN.test(t) && IMG_WEAK_VERB.test(t);
}

/* Kalite modu: yüksek nitelik beklenen üretim işlerinde taslak→eleştiri→düzelt. */
export function autoQuality(text: string, effort: Effort): boolean {
  const t = (text || "").trim();
  if (effort === "max") return true;
  return t.length > 400 && /\b(rapor|makale|doküman|dokümantasyon|tasarla|planla|öneri|strateji)\b/i.test(t);
}

/* Füzyon (3 taslak → hakem → sentez) yalnız ÜRETİM işlerinde: bir site/
   uygulama/arayüz/kod ÜRETMESİ istendiğinde. Hem üretim nesnesi hem üretim
   fiili aranır → "bu sitede hata var mı?" gibi sohbet cümleleri tetiklemez. */
const FUSION_NOUN =
  /(web ?sitesi|\bsite\b|landing|sayfa|uygulama|\bapp\b|arayüz|\bui\b|dashboard|panel|component|bileşen|\bform\b|portfolyo|portföy|oyun|\bgame\b|e-?ticaret|blog|\bapi\b|\bbot\b|script|eklenti|extension|tema|widget|editör|hesaplayıcı|kod)/i;
const FUSION_VERB =
  /(yap|oluştur|kur|kodla|tasarla|üret|geliştir|inşa|yaz|hazırla|çıkar|build|create|implement|develop|make)/i;

export function autoFusion(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 24) return false;
  return FUSION_NOUN.test(t) && FUSION_VERB.test(t);
}

/* ── Alan-bazlı "regex'ten emin miyiz" değerlendirmesi ─────────────────────
   ÖNCEDEN tek bir global "emin misin" kapısı vardı (yalnız effort'a bakardı):
   effort belirsiz kaldığında quality/fusion GÜÇLÜ bir sinyalden geliyor olsa
   bile mesaj LLM'e gidiyordu. Artık üç alan ayrı değerlendirilir; yalnız
   GERÇEKTEN belirsiz kalan alan(lar) için LLM'e sorulur (bkz. decidePilotAsync
   → route-plan'a yalnız eksik alanlar gönderilir), regex'in zaten emin olduğu
   alanlar LLM'in olası yanlış okumasıyla ASLA ezilmez. */
export interface PilotConfidence {
  effort: boolean;
  quality: boolean;
  fusion: boolean;
}

function isEffortConfident(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 60) return true; // kısa selam/komut/soru
  if (/```/.test(t)) return true; // kod bloğu → regex zaten "high" diyor
  if (autoEffort(t) === "max") return true; // açık "kapsamlı" sinyali
  return false;
}

/* autoQuality'nin kendi eşiği len>400 && anahtar-kelime. Sınırın hemen
   çevresi (300-600 karakter bandı) gerçek bir yargı gerektirir; onun
   DIŞINDAKİ iki uçta (kısa+sinyalsiz kesin hayır, uzun+sinyal kesin evet)
   regex zaten güvenilir. */
function isQualityConfident(text: string, effort: Effort): boolean {
  if (effort === "max") return true;
  const t = (text || "").trim();
  const hasKeyword = /\b(rapor|makale|doküman|dokümantasyon|tasarla|planla|öneri|strateji)\b/i.test(t);
  if (t.length <= 300 && !hasKeyword) return true;
  if (t.length > 600 && hasKeyword) return true;
  return false;
}

/* autoFusion İKİ bağımsız sinyalin (üretim ismi + üretim fiili) kesişimine
   bakıyor. FİİL YOKSA autoFusion zaten kesin false'tur — isim ne olursa
   olsun (FUSION_NOUN'un çıplak "kod" alternatifi kelime sınırı taşımaz,
   "kodu incele/açıkla/düzelt" gibi her debug isteğinde eşleşir; üretim
   fiili yoksa bunun ambiguous sayılması bir kodlama asistanında EN YAYGIN
   isteği — kısa/kod-bloklu debug taleplerini — gereksiz yere ağa
   çıkarırdı). Yalnız FİİL VARKEN hedef isim yoksa (ör. "bunu geliştir" —
   neyi geliştireceği belirsiz) gerçek bir ara bölge var; orada LLM'e sorulur. */
function isFusionConfident(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 24) return true;
  if (!FUSION_VERB.test(t)) return true; // fiil yok → kesin hayır (isim önemsiz)
  return FUSION_NOUN.test(t); // fiil var: isim de varsa kesin evet, yoksa belirsiz
}

/** Açık görsel/araştırma niyeti — bütün kararın (effort/quality/fusion) tek
    parça net olduğu durumlar: bir "kedi çiz" isteğinde kalite/füzyon zaten
    anlamsız, bir "kapsamlı araştır" isteğinde effort zaten üst sınırda. */
function isFullyConfident(text: string): boolean {
  return autoImageGen(text) || autoResearch(text);
}

/** Her alan için ayrı güven değerlendirmesi — decidePilotAsync yalnız
    `false` dönen alanları LLM'e sorar. */
export function pilotConfidence(text: string): PilotConfidence {
  const full = isFullyConfident(text);
  const effort = autoEffort(text);
  return {
    effort: full || isEffortConfident(text),
    quality: full || isQualityConfident(text, effort),
    fusion: full || isFusionConfident(text),
  };
}

/** Geriye dönük uyum: ÜÇÜ BİRDEN emin olduğunda ağa hiç çıkılmaz. */
export function isPilotConfident(text: string): boolean {
  const c = pilotConfidence(text);
  return c.effort && c.quality && c.fusion;
}

/** LLM'in regex'ten FARKLI karar verdiği alanları (yalnız LLM'e SORULMUŞ
    alanlarda) sessizce loglar — HİÇBİR ZAMAN kullanıcı metni göndermez,
    yalnız enum/boole değerleri. Zamanla hangi regex kuralının gerçek
    kullanımda yanıldığını gösteren bir sinyal birikir (bkz. Umai anket
    notu: "regex'i gerçek anlaşmazlıktan öğrensin"). trackEvent zaten
    misafirde/hatada sessizce no-op olur; ana akışı asla etkilemez. */
function logPilotMismatch(
  fields: ("effort" | "quality" | "fusion")[],
  local: PilotDecision,
  llmData: { effort?: string; quality?: boolean; fusion?: boolean },
): void {
  if (fields.includes("effort") && llmData.effort && llmData.effort !== local.effort) {
    trackEvent("pilot_mismatch", "chat", { field: "effort", regex: local.effort, llm: llmData.effort });
  }
  if (fields.includes("quality") && typeof llmData.quality === "boolean" && llmData.quality !== local.quality) {
    trackEvent("pilot_mismatch", "chat", { field: "quality", regex: local.quality, llm: llmData.quality });
  }
  if (fields.includes("fusion") && typeof llmData.fusion === "boolean" && llmData.fusion !== local.fusion) {
    trackEvent("pilot_mismatch", "chat", { field: "fusion", regex: local.fusion, llm: llmData.fusion });
  }
}

function isUsableRoutePlanResponse(
  data: { effort?: unknown; quality?: unknown; fusion?: unknown } | null | undefined,
  fields: ("effort" | "quality" | "fusion")[],
): boolean {
  if (!data || typeof data !== "object") return false;
  for (const f of fields) {
    if (f === "effort" && !(["low", "medium", "high", "max"] as string[]).includes(data.effort as string)) return false;
    if (f === "quality" && typeof data.quality !== "boolean") return false;
    if (f === "fusion" && typeof data.fusion !== "boolean") return false;
  }
  return true;
}

function assemblePilotDecision(
  effort: Effort, quality: boolean, fusion: boolean, web: boolean, research: boolean, swarm: boolean, image: boolean,
): PilotDecision {
  const reasons: string[] = [];
  const effortLabel: Record<Effort, string> = { low: "hızlı", medium: "dengeli", high: "yüksek efor", max: "maksimum efor" };
  reasons.push(effortLabel[effort]);
  if (web && !research) reasons.push("web");
  if (research) reasons.push("derin araştırma");
  if (fusion) reasons.push("füzyon (3 model + hakem)");
  else if (quality) reasons.push("kalite turu");
  if (swarm) reasons.push("ajan ekibi");
  if (image) reasons.push("görsel üretimi");
  return { effort, web, research, quality, fusion, swarm, image, reasons };
}

/** Tek karar noktası (senkron, regex-tabanlı) — ağ isteği ATMAZ. `decidePilotAsync`
    başarısız olduğunda (ağ hatası, format hatası) düştüğü güvenli yedek; ayrıca
    birim testlerde saf/deterministik davranış için kullanılır. */
export function decidePilot(text: string, ctx: { hasRepo: boolean }): PilotDecision {
  const effort = autoEffort(text);
  const research = autoResearch(text);
  const web = research || autoWeb(text);
  const quality = autoQuality(text, effort);
  const fusion = autoFusion(text);
  const swarm = ctx.hasRepo && autoSwarm(text);
  const image = autoImageGen(text);
  return assemblePilotDecision(effort, quality, fusion, web, research, swarm, image);
}

/** LLM-tabanlı yönlendirme kararı — sabit regex yerine `/api/route-plan`'a
    hızlı bir sınıflandırma çağrısı yapar. ÖNCEDEN her mesajda (kısa bir
    "selam" dahil) effort/quality/fusion'ın ÜÇÜ birden LLM'e soruluyordu —
    bloklayan bir ağ turu, gecikme şikayetlerinin bir kaynağıydı. Artık yalnız
    `pilotConfidence`'ın BELİRSİZ bulduğu alan(lar) gönderilir (`fields`):
    regex'in üçü birden emin olduğu mesajlarda (kısa selam/komut, açık
    "kapsamlı" sinyali, kod bloğu, açık görsel/araştırma niyeti) ağa hiç
    çıkılmaz; regex'in zaten emin olduğu tekil alanlar da LLM'in olası yanlış
    okumasıyla ASLA ezilmez. web/research/swarm/image hâlâ tamamen regex'te
    kalır (bkz. generate_image/deep_research/dispatch_agents araçları).
    Ağ/format hatasında SESSİZCE senkron `decidePilot`'a düşer — sohbet akışı
    asla bloklanmaz/bozulmaz. */
export async function decidePilotAsync(
  text: string,
  ctx: { hasRepo: boolean },
  llm: { baseUrl: string; model: string; apiKey: string } | null,
): Promise<PilotDecision> {
  const local = decidePilot(text, ctx);
  const conf = pilotConfidence(text);
  if (conf.effort && conf.quality && conf.fusion) return local;

  const fields: ("effort" | "quality" | "fusion")[] = [];
  if (!conf.effort) fields.push("effort");
  if (!conf.quality) fields.push("quality");
  if (!conf.fusion) fields.push("fusion");

  if (llm?.baseUrl && llm?.model) {
    try {
      const res = await fetch("/api/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, hasRepo: ctx.hasRepo, baseUrl: llm.baseUrl, model: llm.model, apiKey: llm.apiKey, fields }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json() as { effort?: string; quality?: boolean; fusion?: boolean };
        if (isUsableRoutePlanResponse(data, fields)) {
          logPilotMismatch(fields, local, data);
          const effort = conf.effort ? local.effort : (data.effort as Effort);
          const quality = conf.quality ? local.quality : !!data.quality;
          const fusion = conf.fusion ? local.fusion : !!data.fusion;
          return assemblePilotDecision(effort, quality, fusion, local.web, local.research, local.swarm, local.image);
        }
      }
    } catch { /* ağ/zaman aşımı hatası — senkron yedeğe düş */ }
  }
  return local;
}

/* Stüdyo için otomatik çıktı türü (skill) seçimi — brief'ten. Open Design/
   Claude Design sadeliği: kullanıcı tür seçmek ZORUNDA değil; sistem anlar.
   Belirgin sinyal yoksa null döner → çağıran "landing" varsayılanını kullanır. */
export function autoStudioSkill(brief: string): string | null {
  const t = (brief || "").toLowerCase();
  if (!t.trim()) return null;
  const rules: [RegExp, string][] = [
    [/\b(e-?posta|mail|bülten|newsletter)\b/, "email"],
    /* \w* son eki tüketir: Türkçe eklemeli yapı yüzünden "sunum" değil
       "ürün lansman SUNUMU" gibi çekimli biçimler çok daha yaygın. */
    [/\b(sunum\w*|slayt\w*|slide deck|prezentasyon\w*|pitch deck)\b/, "slides"],
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

/* Takip mesajında hangi skill kullanılacağına karar verir (DesignStudio.tsx).
   Bug (Tem 2026, kullanıcı ekran görüntüsü): ilk üretim BAŞARISIZ olursa
   (ör. sunum JSON'u ayrıştırılamazsa) projectSkillId hiç set edilmez
   (çağıran yalnız BAŞARILI üretimden sonra kaydeder) — eski mantık
   `followup ? projectSkillId : autoStudioSkill(brief)` bu durumda HER
   takip mesajında (composer'daki ilk mesajdan sonraki HER gönderim
   followup:true'dur) kilitli `undefined`'ı kullanıp autoStudioSkill'i hiç
   ÇALIŞTIRMIYORDU — kullanıcı "sunum" diye tekrar tekrar yazsa bile.
   Yalnız GERÇEKTEN yerleşmiş bir skill (önceki BAŞARILI üretimden) varsa
   kilitlenir; yoksa brief her seferinde yeniden sınıflandırılır. */
export function resolveStudioSkillId(opts: {
  brief: string;
  followup: boolean;
  projectSkillId?: string | null;
  templateSkillId?: string | null;
}): string | null {
  if (opts.templateSkillId) return opts.templateSkillId;
  if (opts.followup && opts.projectSkillId) return opts.projectSkillId;
  return autoStudioSkill(opts.brief);
}
