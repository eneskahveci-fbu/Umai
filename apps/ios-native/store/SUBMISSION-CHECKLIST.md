# UMAI iOS — App Store Gönderim Kontrol Listesi

Bu listedeki her madde, **gönderimden önce** tamamlanmalıdır. İşaretlenmemiş
madde varsa gönderme — reddedilme ve haftalarca gecikme anlamına gelir.

---

## A. Kodda hazır olanlar ✅

Bunlar bu repoda **yazılmış** durumda:

- [x] `PrivacyInfo.xcprivacy` gizlilik manifestosu (2024'ten beri zorunlu)
- [x] `ITSAppUsesNonExemptEncryption = false` (ihracat uyumu sorusu)
- [x] Minimum yetkilendirme (yalnız Keychain; konum/kişi/mikrofon YOK)
- [x] API anahtarları Keychain'de (`…ThisDeviceOnly` — yedeğe girmez)
- [x] Sohbet dosyası `.completeFileProtection` ile diske yazılır
- [x] İlk açılışta EULA/gizlilik onayı (Guideline 1.2)
- [x] Her yanıtta **içerik bildirme** düğmesi (Guideline 1.2)
- [x] Güvenlik sistem promptu + kaba istem süzgeci (Guideline 1.2)
- [x] "Tüm verilerimi sil" (KVKK md.7 / GDPR md.17)
- [x] Uygulama içi Kullanım Şartları, Gizlilik Politikası, Lisanslar
- [x] Kod çalıştırma YOK (Guideline 2.5.2)
- [x] Git entegrasyonu salt-okunur
- [x] Erişilebilirlik etiketleri (VoiceOver) ana etkileşimlerde

---

## B. Senin doldurman gerekenler ⚠️

### B1. Hukuki metinlerdeki boşluklar
`Resources/Legal/` altındaki iki dosyada köşeli parantezli alanlar var:

- [ ] `PrivacyPolicy.md` → `[VERİ SORUMLUSU ÜNVANI]`, `[ADRES]`,
      `[VERGİ/MERSİS NO]`, `[KEP ADRESİ]`
- [ ] `Terms.md` → `[SAĞLAYICI ÜNVANI]`, `[ADRES]`, `[VERGİ/MERSİS NO]`

> Bunlar boş kalırsa sözleşmenin tarafı ve veri sorumlusu belirsiz olur —
> hem KVKK hem de tüketici mevzuatı açısından eksiktir.

### B2. Destek altyapısı
- [ ] `destek@umai.app` adresini **gerçekten kur ve oku.** Bildirimler buraya
      geliyor; App Store 1.2 "zamanında yanıt" bekliyor (biz 24 saat taahhüt
      ettik).
- [ ] Gizlilik politikasını **herkese açık bir URL'de** yayımla — App Store
      Connect'te "Privacy Policy URL" zorunlu alandır.
- [ ] Destek URL'si (basit bir sayfa yeter).

### B3. Apple Developer hesabı
- [ ] Apple Developer Program üyeliği (yıllık $99)
- [ ] Türkiye'den bireysel/şirket kaydı için **D-U-N-S numarası** (tüzel kişi
      ise; bireysel hesapta gerekmez)
- [ ] App Store Connect'te "Paid Apps" olmasa da **vergi ve banka bilgileri**
      (ücretsiz uygulamada zorunlu değil ama hesabın tamam olması iyi)
- [ ] `project.yml` içindeki `DEVELOPMENT_TEAM` alanına kendi Team ID'ni yaz

### B4. Görseller
- [ ] Uygulama ikonu 1024×1024 (alfa kanalı YOK, köşe yuvarlatma YOK)
- [ ] `Assets.xcassets` içine tüm ikon boyutları
- [ ] Ekran görüntüleri: 6.9" (iPhone 16 Pro Max) ve 6.5" — her biri en az 3 adet
- [ ] `LaunchBackground` renk seti (`project.yml`'de referans veriliyor)

### B5. App Store Connect metinleri
- [ ] Uygulama adı: **UMAI**
- [ ] Alt başlık (30 karakter): örn. "Türkçe yapay zekâ asistanı"
- [ ] Açıklama, anahtar kelimeler, kategori (**Developer Tools** veya
      **Productivity**)
- [ ] **Yaş sınıflandırması**: yapay zekâ üretimi içerik nedeniyle
      "Infrequent/Mild Mature or Suggestive Themes" işaretlenmeli → tipik olarak
      **12+ veya 17+**. Düşük işaretlemek reddedilme sebebidir.
- [ ] Gizlilik etiketleri: **"Data Not Collected"** (kodla tutarlı)
- [ ] İnceleme notları: `AppStore-ReviewNotes.md` içeriğini yapıştır
- [ ] Telif hakkı satırı

---

## C. Gönderimden önce çalıştır

```bash
brew install xcodegen
cd apps/ios-native && xcodegen generate
open UMAI.xcodeproj
```

- [ ] Gerçek cihazda derlenip çalışıyor (simülatör yetmez)
- [ ] İlk açılış → şartları kabul → mesaj gönder → yanıt geliyor
- [ ] Bildir düğmesi e-posta taslağı açıyor
- [ ] Ayarlar → Tüm verilerimi sil çalışıyor
- [ ] Uçak modunda anlamlı hata mesajı çıkıyor (ham hata kodu değil)
- [ ] VoiceOver ile ana akış gezilebiliyor
- [ ] Dinamik yazı tipi büyütülünce arayüz bozulmuyor
- [ ] Archive → Validate → Upload

---

## D. Bilinçli olarak MVP dışı bırakılanlar

Bunlar eksiklik değil, **kapsam kararı**. Sorulursa cevabı hazır olsun:

| Bırakılan | Neden |
|---|---|
| Kod çalıştırma / terminal | Guideline 2.5.2 riski; ayrıca ilk sürümde gereksiz risk |
| Depoya yazma / commit | Kullanıcının deposuna zarar verme riski sıfırda tutuldu |
| Stüdyolar (tasarım, doküman, anket…) | Talep edilen kapsam "yalnızca coder" |
| Hesap / bulut senkron | Sunucusuz mimari; gizlilik vaadini basit tutuyor |
| Uygulama içi satın alma | Ücretsiz ürün; Guideline 3.1.1 yüzeyini sıfırlıyor |
| Push bildirim | MVP'de işlevsel karşılığı yok |

---

## E. Google Play (sonraki adım)

Swift ile Play Store'a çıkılamaz. Sıradaki iş için iki seçenek:

1. **Kotlin/Compose ile ayrı native uygulama** — bu repodaki `Services/`
   katmanı birebir çevrilebilir (saf mantık, UI'dan ayrı yazıldı).
2. **Capacitor** — web uygulaması zaten yapılandırılmış (`capacitor.config.ts`).

Play tarafında ayrıca gerekecek: **Data Safety formu** (bu repodaki gizlilik
beyanıyla aynı içerik), hedef API seviyesi uyumu ve yapay zekâ uygulamaları için
Play'in kendi içerik politikası beyanı.
