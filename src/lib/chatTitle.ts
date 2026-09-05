/* Otomatik sohbet başlığı için SAF doğrulayıcı.

   Gönderim anında başlık kullanıcının metninden kurulur (store.maybeSetTitle)
   ve bu makul bir başlıktır. İlk yanıttan sonra bir "AI başlık" üretilir; eski
   kod modelin ilk satırını ≤60 karakterse DENETİMSİZ kabul edip o makul başlığı
   eziyordu. Talimatı yok sayan zayıf bir model (anahtarsız ücretsiz varsayılan
   dahil) "Tabii, işte basit bir sayfa:" diye cevaba başladığında sohbet
   listesi "Tabii," / "Elbette!" gibi işe yaramaz başlıklarla doluyordu.

   Kural: adayın gerçekten bir BAŞLIK gibi görünmesi gerekir; değilse null
   döner ve çağıran taraf mevcut (kullanıcı metninden gelen) başlığı korur.
   Yanlış reddetmenin bedeli düşük (iyi bir yedek zaten var), yanlış kabulün
   bedeli görünür — o yüzden kurallar tutucu. */

/* Yanıta "cümle" olarak başlayan tipik açılışlar. Küçük harfe tr yerel
   ayarıyla çevrilmiş metne uygulanır; JS regex'inde `\b` Türkçe harflerde
   çalışmadığından (CLAUDE.md) sınır elle veriliyor. */
const OPENERS =
  /^(tabii|tabi|elbette|işte|merhaba|selam|hazır|olur|peki|harika|şöyle|aşağıda|kesinlikle|memnuniyetle|tamam)(?=$|[\s,:.!])/;

export function sanitizeAiTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = raw.split("\n")[0].trim();
  t = t.replace(/^["'«“”]+|["'»“”]+$/g, "").trim();
  t = t.replace(/^(başlık|title)\s*[:：]\s*/i, "").trim(); // "Başlık: X" → X
  t = t.replace(/[.。!?]+$/g, "").trim();                    // sondaki cümle noktalaması
  if (!t || t.length > 60) return null;
  if (/[:,;…]$/.test(t)) return null;                        // "…işte:" gibi giriş cümlesi
  if (t.split(/\s+/).length > 7) return null;                // başlık değil cümle
  if (OPENERS.test(t.toLocaleLowerCase("tr"))) return null;
  return t;
}
