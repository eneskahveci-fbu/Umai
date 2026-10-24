# Güvenlik Politikası

UMAI, kullanıcı API anahtarları ve yerel köprü/terminal sunucusu ile çalıştığı
için güvenlik bildirimlerini ciddiye alıyoruz.

## Desteklenen sürümler

Yalnızca `main` dalındaki güncel sürüm desteklenir. Eski commit'ler ve
çatallar (fork) için güvenlik düzeltmesi garanti edilmez.

## Açık bulduysan

**Lütfen herkese açık bir issue açma.** Bunun yerine
[eneskahveci.bs@gmail.com](mailto:eneskahveci.bs@gmail.com) adresine yaz.

Konu satırına `[GÜVENLİK]` ekle. Mümkünse şunları paylaş:

- Etkilenen dosya/özellik ve sürüm (commit SHA),
- Sorunu yeniden üretme adımları,
- Olası etkisi (veri sızıntısı, komut çalıştırma, yetki yükseltme…),
- Varsa önerdiğin düzeltme.

## Kapsam

Özellikle şu alanlar ilgi alanımızda:

- `local-bridge/` ve `terminal-server/` (token doğrulama, yol/symlink kaçışı,
  komut çalıştırma, salt-okunur mod),
- `/api/*` uçları (SSRF, kimlik doğrulama, hız/limit, hata mesajlarında sızıntı),
- İstemci tarafında anahtar saklama ve log'lara yazılma,
- Supabase RLS ve oturum güvenliği,
- Prompt injection ile araç kötüye kullanımı.

## Kapsam dışı

- Kendi barındırdığın sunucunun yanlış yapılandırılması (ör. token'ı herkese
  açık bırakmak, `ALLOWED_ORIGIN=*` ile internete açmak),
- Ücretsiz model sağlayıcılarının kendi politikaları,
- Sosyal mühendislik.

## Süreç

Bildirimi en kısa sürede inceleyip doğrularız. Düzeltme yayınlanana kadar
ayrıntıları gizli tutmanı rica ederiz. Katkın için teşekkürler.
