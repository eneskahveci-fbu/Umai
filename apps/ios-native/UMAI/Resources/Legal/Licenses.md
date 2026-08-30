# Açık Kaynak Bildirimleri

**Son güncelleme:** 30 Ağustos 2026

## Üçüncü taraf kütüphaneler

UMAI iOS uygulaması, MVP kapsamında **hiçbir üçüncü taraf çalışma zamanı
bağımlılığı kullanmaz.** Uygulama yalnızca Apple'ın işletim sistemiyle birlikte
gelen çerçeveleri kullanır:

- **SwiftUI** — arayüz
- **Foundation** — temel tipler, ağ (URLSession)
- **Security** — Anahtar Zinciri (API anahtarlarının saklanması)

Bunlar Apple tarafından sağlanır ve iOS SDK lisansına tabidir; ayrı bir açık
kaynak bildirimi gerektirmez.

> Bu bilinçli bir karardır: her bağımlılık, App Store incelemesinde açıklanması
> gereken bir yüzey, bir güvenlik riski ve bir gizlilik manifestosu yükümlülüğü
> getirir. MVP'de sözdizimi renklendirmesi bile harici bir kütüphane yerine
> uygulama içinde, bağımlılıksız yazılmıştır.

## Geliştirme araçları (uygulamaya dahil DEĞİL)

Aşağıdaki araç yalnızca projeyi üretmek için kullanılır ve uygulama paketine
girmez:

- **XcodeGen** (MIT Lisansı) — `project.yml` dosyasından Xcode projesi üretir.
  https://github.com/yonaskolb/XcodeGen

## Bağımlılık eklenirse

Projeye yeni bir kütüphane eklendiğinde:

1. Lisans metni bu dosyaya eklenmelidir.
2. Kütüphanenin kendi `PrivacyInfo.xcprivacy` manifestosu varsa, uygulamanın
   gizlilik beyanıyla çelişmediği doğrulanmalıdır.
3. Kütüphane veri topluyorsa, App Store gizlilik etiketleri ve Gizlilik
   Politikası **güncellenmelidir** — aksi hâlde beyan yanlış olur.
