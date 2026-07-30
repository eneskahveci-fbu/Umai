/* Yapılandırılmış (JSON) üretimin ORTAK katmanı — beş içerik stüdyosu + Sunum.

   Neden ayrı bir modül: genChat.ts taşıma katmanıdır (istek at, SSE topla).
   Bu dosya onun ÜSTÜNDE duran orkestrasyon: native JSON modu, token bütçesi
   ve geçersiz çıktıda katı talimatla bir kez yeniden deneme. `streamChat`'i
   içeri IMPORT ederek çağırır — böylece motorların testleri genChat'i mock'layıp
   bu katmanı gerçek hâliyle doğrulayabilir.

   Denetim bulgusu (Tem 2026): Sunum motoru bu üç korumaya sahipti; aynı
   çekirdeği kullanan Doküman/Anket/Defter/Kroki/Kartlar ise hiçbirine sahip
   değildi. jsonMode olmadan zayıf modeller düz metin döndürüyor, maxTokens
   olmadan uzun çıktı 8192'de kesiliyor, yeniden deneme olmadan hepsi TEK
   denemede ölüyordu — aynı model Sunum'da çalışırken diğerlerinde patlıyordu. */
import { streamChat, type GenChatOptions } from "./genChat";
import { isModelOutputError } from "./friendlyError";

/* Modelin JSON şemasına uymadığı (fazladan açıklama, eksik virgül, kaçırılmamış
   tırnak — özellikle zayıf/ücretsiz modellerde sık) durumda İKİNCİ denemeye
   eklenen, daha KATI talimat. Önceden yalnız slidesGen.ts'te vardı. */
export const STRICT_JSON_RETRY_SUFFIX =
  "\n\nÖNEMLİ: Bir önceki yanıt geçerli/tam JSON DEĞİLDİ. Bu kez YALNIZCA " +
  "tek bir dengeli JSON nesnesi yaz — kod bloğu işareti (```), açıklama, " +
  "giriş/kapanış cümlesi YOK. İlk karakter '{' ve son karakter '}' olsun.";

/* Motorların kendi `parseXJson`'ları düz `Error` fırlatıyor (ör. "Doküman
   JSON'u bozuk — tekrar dene."). Bunlar da ayrıştırma hatasıdır → yeniden
   denemeye değer. Ağ/kimlik/kota hatalarından ayırmak için metne bakılır:
   onlarda ikinci deneme yalnız beklemeyi ikiye katlar ve ilk (doğru) hatayı
   ezer — bu yüzden ayrım şart. */
function isParseFailure(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /JSON|ayrıştır|bozuk|tamamlanmamış|geçersiz/i.test(m);
}

/**
 * Şemalı JSON üretir; model bozuk/eksik çıktı verirse daha katı bir talimatla
 * BİR KEZ daha dener.
 *
 * `parse` her motorun KENDİ `parseXJson` fonksiyonudur — Türkçe hata metinleri
 * ve normalizasyon aynen korunur, bu katman yalnız dayanıklılığı ekler.
 */
export async function streamJson<T>(
  opts: GenChatOptions & { parse: (raw: string) => T; maxTokens: number },
): Promise<T> {
  const { parse, ...chat } = opts;
  const run = (system: string) => streamChat({ ...chat, system, jsonMode: true });

  try {
    return parse(await run(chat.system));
  } catch (e) {
    /* İptal kullanıcının kendi kararı — tekrar isteme. */
    if ((e as Error)?.name === "AbortError") throw e;
    /* Yapılandırma/kimlik/kota hatası ayrıştırma sorunu DEĞİL → hemen yükselt. */
    if (!isModelOutputError(e) && !isParseFailure(e)) throw e;
    return parse(await run(chat.system + STRICT_JSON_RETRY_SUFFIX));
  }
}
