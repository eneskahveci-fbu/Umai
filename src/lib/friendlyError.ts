/* Teknik LLM/ağ hatalarını kullanıcı diline çevirir. Eşleşme yoksa ham metin
   döner (bilgi kaybolmaz). Saf fonksiyon → birim testli. CoderView ve stüdyolar
   ortak kullanır. */
export function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (/(401|403|unauthorized|invalid api key|invalid_api_key|authentication)/.test(m))
    return "Geçersiz veya eksik API anahtarı. Ayarlar → Modeller'den anahtarını kontrol et.";
  if (/(429|rate limit|too many requests|quota|insufficient_quota)/.test(m))
    return "İstek sınırına (rate limit) takıldın veya kotan bitti. Biraz bekle ya da başka bir model/sağlayıcı dene.";
  if (/(timeout|timed out|etimedout|deadline)/.test(m))
    return "İstek zaman aşımına uğradı. Bağlantını kontrol et ve tekrar dene; istek çok uzunsa kısaltmayı dene.";
  if (/(failed to fetch|network|networkerror|err_network|connection|econnrefused|fetch failed)/.test(m))
    return "Ağ/bağlantı sorunu. İnternetini kontrol et; sağlayıcı erişilemiyor olabilir.";
  if (/(404|not found|model.*(not found|does not exist)|unknown model)/.test(m))
    return "Model bulunamadı. Ayarlar'dan model adının doğru yazıldığından emin ol.";
  if (/(500|502|503|529|overloaded|service unavailable|server error)/.test(m))
    return "Sağlayıcı şu an yoğun veya geçici olarak yanıt vermiyor. Birkaç saniye sonra tekrar dene.";
  return raw;
}
