/* Teknik LLM/ağ hatalarını kullanıcı diline çevirir. Eşleşme yoksa ham metin
   döner (bilgi kaybolmaz). Saf fonksiyon → birim testli. CoderView ve stüdyolar
   ortak kullanır. */

/**
 * Modelin KENDİ çıktısından kaynaklanan hata (ör. JSON yerine düz metin
 * döndürdü, çıktı yarıda kesildi). Mesajı modelin gerçek yanıtından bir
 * ÖRNEK taşır ve olduğu gibi gösterilmelidir.
 *
 * Neden ayrı bir sınıf: `friendlyError` desenleri ham metinde arıyor ve model
 * yanıtı pekâlâ "500 kelimelik bir metin" ya da "404 sayfası tasarla" gibi
 * ifadeler içerebiliyor. Böyle bir örnek `friendlyError`'dan geçirilirse
 * "Sağlayıcı şu an yoğun…" diye ÇEVRİLİYOR — yani studioExtract.ts'in ortadan
 * kaldırmak için yazıldığı yanlış teşhisin ta kendisi geri geliyor. Regex'i
 * daha da daraltmak çözmez: prozadaki çıplak üç haneli sayı her zaman
 * belirsizdir. Doğru ayrım tip düzeyinde yapılır (bkz. friendlyErrorFrom).
 */
export class ModelOutputError extends Error {
  /** Modelin gerçekte döndürdüğü metinden kısa örnek (varsa). */
  sample?: string;
  constructor(message: string, sample?: string) {
    super(message);
    this.sample = sample;
    this.name = "ModelOutputError";
  }
}

export function isModelOutputError(e: unknown): e is ModelOutputError {
  return e instanceof ModelOutputError;
}

export function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
  /* \b sınırları savunma amaçlı: "1500 kelime" ya da "sipariş #5031" gibi
     metinlerde 500/503'ün yanlışlıkla eşleşmesini engeller. Asıl koruma yine
     de tip düzeyindedir (friendlyErrorFrom) — bu yalnız ikinci savunma hattı. */
  if (/(\b401\b|\b403\b|unauthorized|invalid api key|invalid_api_key|authentication)/.test(m))
    return "Geçersiz veya eksik API anahtarı. Ayarlar → Modeller'den anahtarını kontrol et.";
  if (/(\b429\b|rate limit|too many requests|quota|insufficient_quota)/.test(m))
    return "İstek sınırına (rate limit) takıldın veya kotan bitti. Biraz bekle ya da başka bir model/sağlayıcı dene.";
  if (/(timeout|timed out|etimedout|deadline)/.test(m))
    return "İstek zaman aşımına uğradı. Bağlantını kontrol et ve tekrar dene; istek çok uzunsa kısaltmayı dene.";
  if (/(failed to fetch|network|networkerror|err_network|connection|econnrefused|fetch failed)/.test(m))
    return "Ağ/bağlantı sorunu. İnternetini kontrol et; sağlayıcı erişilemiyor olabilir.";
  if (/(\b404\b|not found|model.*(not found|does not exist)|unknown model)/.test(m))
    return "Model bulunamadı. Ayarlar'dan model adının doğru yazıldığından emin ol.";
  if (/(\b500\b|\b502\b|\b503\b|\b529\b|overloaded|service unavailable|server error)/.test(m))
    return "Sağlayıcı şu an yoğun veya geçici olarak yanıt vermiyor. Birkaç saniye sonra tekrar dene.";
  return raw;
}

/**
 * Yakalanan bir hatayı kullanıcı diline çevirir — `friendlyError`'ın
 * tip-farkında sarmalayıcısı. Stüdyo üretim çağrılarının `catch` bloklarında
 * `friendlyError(e.message)` YERİNE bunu kullan: modelin kendi metnini taşıyan
 * hatalar olduğu gibi geçer, geri kalan her şey eskisi gibi çevrilir.
 */
export function friendlyErrorFrom(e: unknown, fallback = "bilinmeyen hata"): string {
  if (isModelOutputError(e)) return e.message;
  if ((e as Error | null)?.name === "AbortError") return "İşlem iptal edildi.";
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return friendlyError(msg || fallback);
}
