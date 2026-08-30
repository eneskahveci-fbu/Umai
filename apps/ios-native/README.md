# UMAI — iOS (SwiftUI)

UMAI'nin **yalnızca coder** yüzeyini içeren native iOS uygulaması. Web
uygulamasındaki stüdyolar (tasarım, doküman, anket, defter, kart, kroki, sunum)
bilinçli olarak **dışarıda** bırakılmıştır.

## Ne var

| Özellik | Durum |
|---|---|
| Akışlı sohbet (SSE) | ✅ |
| Çoklu sağlayıcı + otomatik fallback | ✅ |
| Anahtarsız ücretsiz başlangıç | ✅ |
| BYOK — kendi ücretsiz anahtarını bağla | ✅ |
| Markdown + kod bloğu sözdizimi renklendirme | ✅ |
| Sohbet geçmişi, arama, Markdown dışa aktarma | ✅ |
| GitHub/GitLab depo gözatıcı (salt-okunur) | ✅ |
| API anahtarları Keychain'de | ✅ |
| Uygulama içi hukuki belgeler + onay akışı | ✅ |
| İçerik bildirme (App Store 1.2) | ✅ |
| Tüm verileri silme (KVKK/GDPR) | ✅ |

## Kurulum

```bash
brew install xcodegen
cd apps/ios-native
xcodegen generate
open UMAI.xcodeproj
```

`project.yml` içindeki `DEVELOPMENT_TEAM` alanına kendi Apple Team ID'ni yaz
(ya da Xcode'da Signing & Capabilities'ten seç).

> `UMAI.xcodeproj` ve `UMAI/Info.plist` **üretilen** dosyalardır; sürüm
> kontrolüne girmezler. Kaynak `project.yml`'dir.

## Dizin yapısı

```
apps/ios-native/
├── project.yml                  # XcodeGen proje tanımı
├── UMAI/
│   ├── App/                     # Giriş noktası, kök görünüm
│   ├── Models/                  # Chat, ChatMessage, ModelProfile, Provider
│   ├── Services/
│   │   ├── KeychainStore.swift  # API anahtarları (Keychain)
│   │   ├── ChatService.swift    # SSE akış + fallback zinciri
│   │   ├── ChatStore.swift      # Kalıcılık, arama, veri silme
│   │   ├── GitService.swift     # GitHub/GitLab (salt-okunur)
│   │   └── ContentSafety.swift  # App Store 1.2 uyumu
│   ├── Views/                   # SwiftUI ekranları
│   ├── Resources/
│   │   ├── PrivacyInfo.xcprivacy
│   │   └── Legal/               # Uygulamaya gömülü hukuki metinler
│   └── UMAI.entitlements
├── UMAITests/                   # Saf mantık testleri
└── store/                       # Gönderim paketi
    ├── AppStore-ReviewNotes.md
    └── SUBMISSION-CHECKLIST.md
```

## Mimari kararlar

**Sunucusuz.** Sohbetler ve anahtarlar cihazda kalır. Bu, gizlilik vaadini
basit ve doğrulanabilir tutar; App Store gizlilik etiketi "veri toplanmıyor"
olarak beyan edilir ve `PrivacyInfo.xcprivacy` ile birebir tutarlıdır.

**Bağımlılık yok.** Yalnızca SwiftUI/Foundation/Security. Sözdizimi
renklendirmesi bile uygulama içinde yazıldı. Her bağımlılık, incelemede
açıklanacak bir yüzey ve bir gizlilik manifestosu yükümlülüğü getirir.

**Saf mantık UI'dan ayrı.** `Services/` ve doğrulayıcılar görünümden bağımsız
yazıldı; hem test edilebilir hem de Android'e (Kotlin) çevrilmesi kolay.

**Salt-okunur Git.** İlk sürümde kullanıcının deposuna zarar verme riski
sıfırda tutuldu.

**Kod çalıştırma yok.** App Store Guideline 2.5.2 gereği ve bilinçli tercih.

## Sonraki adım — Google Play

Swift ile Play Store'a çıkılamaz. `Services/` katmanı saf mantık olduğu için
Kotlin'e çevrilmeye elverişlidir; alternatif olarak kök dizindeki Capacitor
yapılandırması kullanılabilir. Ayrıntı: `store/SUBMISSION-CHECKLIST.md` bölüm E.

## ⚠️ Derlenmedi

Bu kod, Swift araç zinciri bulunmayan bir Linux ortamında yazıldı — **derlenip
çalıştırılmadı.** Xcode'da ilk açılışta düzeltilmesi gerekebilecek küçük
derleyici hataları olabilir. Gönderim öncesi `store/SUBMISSION-CHECKLIST.md`
bölüm C'deki adımları uygula.
