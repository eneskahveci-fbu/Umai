# UMAI iOS — App Store Gönderim Kontrol Listesi

Bu listedeki her madde gönderimden önce tamamlanmalıdır. İşaretlenmemiş madde
varsa gönderme — reddedilme ve haftalarca gecikme demektir.

---

## A. Kodda hazır olanlar ✅

- [x] `PrivacyInfo.xcprivacy` gizlilik manifestosu (2024'ten beri zorunlu)
- [x] `ITSAppUsesNonExemptEncryption = false` (ihracat uyumu)
- [x] Minimum yetkilendirme (yalnız Keychain; konum/kişi/mikrofon YOK)
- [x] API anahtarları Keychain'de (`…ThisDeviceOnly` — yedeğe girmez)
- [x] Sohbet dosyası `.completeFileProtection` ile yazılır
- [x] İlk açılışta EULA/gizlilik onayı (Guideline 1.2)
- [x] Her yanıtta içerik **bildirme** düğmesi (Guideline 1.2)
- [x] Güvenlik sistem promptu + kaba istem süzgeci (Guideline 1.2)
- [x] "Tüm verilerimi sil" (KVKK md.7 / GDPR md.17)
- [x] Uygulama içi Şartlar / Gizlilik / Lisanslar
- [x] Kod çalıştırma YOK (Guideline 2.5.2)
- [x] Git entegrasyonu salt-okunur
- [x] `Assets.xcassets`: AppIcon (1024×1024, alfa kanalsız), LaunchBackground,
      AccentColor

---

## B. DERLEMEYİ / YÜKLEMEYİ DURDURANLAR 🔴

Bunlar yapılmadan uygulama **derlenmez veya yüklenemez.**

- [ ] **Xcode'da derle.** Bu kod Swift araç zinciri olmayan bir ortamda yazıldı
      ve **hiç derlenmedi.** Küçük derleyici hataları beklenmelidir.
      ```bash
      brew install xcodegen
      cd apps/ios-native && xcodegen generate && open UMAI.xcodeproj
      ```
- [ ] `project.yml` → `DEVELOPMENT_TEAM` alanına kendi Apple Team ID'ni yaz
- [ ] Bundle identifier'ı doğrula: `com.umai.app` (Apple Developer'da kayıtlı
      olmalı ve `UMAI.entitlements` içindeki Keychain grubuyla eşleşmeli)
- [ ] Ekran görüntüleri: 6.9" (iPhone 16 Pro Max) ve 6.5" — her biri en az 3 adet

---

## C. REDDEDİLME SEBEBİ OLANLAR 🟠

### C1. Destek altyapısı — Guideline 1.2'nin ayağı
Kod `destek@umai.app` adresini **sabit** içeriyor (`ContentSafety.swift`).

- [ ] **`umai.app` alan adına sahip misin?** Değilsen ya al ya da koddaki
      adresi değiştir. Çalışmayan bir bildirim adresi, Guideline 1.2'nin
      "zamanında yanıt" şartını doğrudan çökertir.
- [ ] E-postayı gerçekten kur ve **oku** (24 saat taahhüt ettik — Terms.md md.5)
- [ ] **Gizlilik Politikası herkese açık bir URL'de yayımlanmalı.** App Store
      Connect'te "Privacy Policy URL" **zorunlu alandır**; uygulama içi kopya
      bu şartı karşılamaz.
- [ ] Destek URL'si (basit bir sayfa yeter, ama erişilebilir olmalı)

### C2. Marka riski — Guideline 5.2.1
"UMAI" Japonca'da yaygın bir kelimedir (*umai* = lezzetli) ve App Store'da
benzer adlı uygulamalar bulunma ihtimali yüksektir.

- [ ] App Store'da "UMAI" araması yap — çakışan bir uygulama var mı?
- [ ] TÜRKPATENT ve EUIPO'da marka araması yap
- [ ] Gerekirse marka başvurusu (9. ve 42. sınıf: yazılım / SaaS)

> Marka çakışması, kodla ilgisi olmayan ama **gönderimi tamamen durduran** bir
> sebeptir. Önce kontrol et, sonra ekran görüntüsü hazırla.

### C3. Yaş sınıflandırması
Apple'ın güncellenmiş yaş sınıflandırma anketinde yapay zekâ sohbetine ilişkin
sorular var. Kısıtsız yapay zekâ sohbeti barındıran uygulamalar tipik olarak
**12+ ya da 17+** alır.

- [ ] Anketi **dürüst** doldur. Düşük işaretlemek en sık red sebeplerindendir
      ve sonradan yakalanırsa uygulama mağazadan kaldırılır.

### C4. App Store Connect metinleri
- [ ] Gizlilik etiketleri: **"Data Not Collected"** (kodla tutarlı)
- [ ] İnceleme notları: `AppStore-ReviewNotes.md` içeriğini yapıştır
- [ ] Alt başlık, açıklama, anahtar kelimeler, kategori (Developer Tools)
- [ ] Telif hakkı satırı

---

## D. HUKUKİ YÜKÜMLÜLÜKLER (Apple'dan bağımsız) ⚖️

Bunlar App Store incelemesini geçse bile **Türkiye/AB hukuku** açısından
gereklidir.

### D1. Hukuki metinlerdeki boşluklar
- [ ] `Resources/Legal/PrivacyPolicy.md` → `[VERİ SORUMLUSU ÜNVANI]`,
      `[ADRES]`, `[VERGİ/MERSİS NO]`, `[KEP ADRESİ]`
- [ ] `Resources/Legal/Terms.md` → `[SAĞLAYICI ÜNVANI]`, `[ADRES]`,
      `[VERGİ/MERSİS NO]`

> Boş kalırsa sözleşmenin tarafı ve veri sorumlusu belirsiz olur.

### D2. Kimlik / tüzel yapı
- [ ] Uygulamayı **kim** yayımlıyor: şahıs mı, şirket mi? Gizlilik
      politikasındaki "veri sorumlusu" ile App Store yayıncı adı **aynı**
      olmalı.
- [ ] Apple Developer Program üyeliği (yıllık ~$99)
- [ ] Tüzel kişi olarak kaydolacaksan **D-U-N-S numarası** (bireysel hesapta
      gerekmez)

### D3. KVKK
- [ ] **VERBİS kaydı gerekli mi?** Yıllık çalışan sayısı 50'den az **ve** mali
      bilanço eşiğin altındaysan ve ana faaliyetin veri işleme değilse
      muafiyet kapsamında olabilirsin. Eşikler değişebildiği için KVKK'nın
      güncel tebliğinden doğrula.
- [ ] Aydınlatma yükümlülüğü: karşılama ekranındaki metin bunu karşılıyor,
      ancak **yayımlanan web sayfasında da** aynı bilgi bulunmalı.

### D4. GDPR (AB kullanıcısı hedefliyorsan)
- [ ] AB'de yerleşik değilsen ve AB kullanıcılarına hizmet veriyorsan
      **GDPR md.27 uyarınca AB temsilcisi** atanması gerekebilir. Uygulama
      sunucusuz olduğu için işleme sınırlı; yine de hukukçuya danış.

### D5. Üçüncü taraf sağlayıcı şartları 🔴 **BU ÖNEMLİ**
Uygulama, anahtarsız varsayılan olarak **Pollinations**'a istek gönderiyor —
yani **senin** uygulamandan gelen tüm ücretsiz trafik, üçüncü bir tarafın
altyapısına anahtarsız düşüyor.

- [ ] Pollinations'ın kullanım şartlarını oku: **ticari bir uygulamada
      varsayılan arka uç olarak kullanmaya izin veriyor mu?** Atıf istiyor mu?
- [ ] İzin vermiyorsa iki seçenek: (a) kendi anahtarınla resmi bir ücretsiz
      katmana geç, (b) varsayılanı kaldırıp ilk açılışta BYOK'u zorunlu kıl —
      ama (b), "kurulum yok" vaadini bozar.
- [ ] Gemini/Groq/Cerebras: bunlarda kullanıcı **kendi** anahtarını getirdiği
      için sözleşme kullanıcı ile sağlayıcı arasındadır — bu taraf temiz.

> Bu bir App Store maddesi değil, **iş sürekliliği** riski: sağlayıcı trafiği
> kesmeye karar verirse uygulaman varsayılan hâlde çalışmaz.

---

## E. Gönderimden önce çalıştır

- [ ] Gerçek cihazda derlenip çalışıyor (simülatör yetmez)
- [ ] İlk açılış → şartları kabul → mesaj gönder → yanıt geliyor
- [ ] Bildir düğmesi e-posta taslağı açıyor ve adres **doğru**
- [ ] Ayarlar → Tüm verilerimi sil çalışıyor
- [ ] Uçak modunda anlamlı hata mesajı (ham hata kodu değil)
- [ ] VoiceOver ile ana akış gezilebiliyor
- [ ] Dinamik yazı tipi büyütülünce arayüz bozulmuyor
- [ ] Archive → Validate → Upload

---

## F. Bilinçli olarak MVP dışı bırakılanlar

Eksiklik değil, **kapsam kararı**. İnceleme sorarsa cevabı hazır olsun:

| Bırakılan | Neden |
|---|---|
| Kod çalıştırma / terminal | Guideline 2.5.2 riski |
| Depoya yazma / commit | Kullanıcının deposuna zarar verme riski sıfırda |
| Stüdyolar | Talep edilen kapsam "yalnızca coder" |
| Hesap / bulut senkron | Sunucusuz mimari; gizlilik vaadi basit kalıyor |
| Uygulama içi satın alma | Guideline 3.1.1 yüzeyini sıfırlıyor |
| Push bildirim | MVP'de işlevsel karşılığı yok |

---

## G. Google Play (sonraki adım)

Swift ile Play Store'a çıkılamaz.

1. **Kotlin/Compose ile ayrı native uygulama** — `Services/` katmanı saf mantık
   olduğu için birebir çevrilebilir.
2. **Capacitor** — web uygulaması zaten yapılandırılmış.

Play tarafında ek olarak gerekecek:
- **Data Safety formu** (bu repodaki gizlilik beyanıyla aynı içerik)
- Hedef API seviyesi uyumu
- Play'in **Yapay Zekâ Tarafından Üretilen İçerik** politikası beyanı
- Kullanıcıların uygunsuz içerik bildirebileceği bir yol (bizde zaten var)
