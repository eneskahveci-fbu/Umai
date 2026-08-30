# UMAI — Gizlilik Politikası

**Son güncelleme:** 30 Ağustos 2026
**Sürüm:** 1.0

> ⚠️ **DOLDURULMASI GEREKEN ALANLAR**
> Bu metin, uygulamanın gerçek teknik davranışına göre yazılmıştır ve
> yayımlanmadan önce aşağıdaki alanlar doldurulmalıdır. Bunlar boş kalırsa
> belge hukuken eksik olur:
> - `[VERİ SORUMLUSU ÜNVANI]` — şahıs şirketi ise ad-soyad, tüzel kişi ise ticaret ünvanı
> - `[ADRES]` — tebligata elverişli açık adres
> - `[VERGİ/MERSİS NO]`
> - `[KEP ADRESİ]` (varsa)
> Ayrıca bu metnin bir kopyası herkese açık bir web adresinde yayımlanmalıdır;
> App Store Connect "Privacy Policy URL" alanı zorunludur.

---

## 1. Özet

UMAI'nin **sunucusu yoktur.** Sohbetleriniz ve API anahtarlarınız yalnızca
kendi cihazınızda saklanır. Biz sizden hiçbir veri toplamıyor, saklamıyor veya
üçüncü taraflarla paylaşmıyoruz.

Tek istisna: siz bir mesaj gönderdiğinizde, o mesaj **sizin seçtiğiniz** yapay
zekâ sağlayıcısına doğrudan cihazınızdan gider. Biz bu iletişimin arasında
değiliz ve içeriğinin kopyasını almıyoruz.

## 2. Veri sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve AB Genel Veri Koruma
Tüzüğü (GDPR) uyarınca veri sorumlusu:

- **Ünvan:** [VERİ SORUMLUSU ÜNVANI]
- **Adres:** [ADRES]
- **Vergi/MERSİS No:** [VERGİ/MERSİS NO]
- **E-posta:** destek@umai.app
- **KEP:** [KEP ADRESİ]

## 3. Hangi veriler nerede tutulur

| Veri | Nerede | Bize gelir mi? |
|---|---|---|
| Sohbet geçmişiniz | Yalnızca cihazınızda (uygulama konteyneri, dosya koruması açık) | **Hayır** |
| API anahtarlarınız | Yalnızca cihazınızın iOS Anahtar Zinciri'nde (yedeklere ve başka cihaza taşınmaz) | **Hayır** |
| Git erişim anahtarınız | Yalnızca cihazınızın iOS Anahtar Zinciri'nde | **Hayır** |
| Uygulama tercihleri (tema, aktif model) | Yalnızca cihazınızda | **Hayır** |
| Kimlik/hesap bilgisi | **Toplanmıyor** — UMAI hesap açmanızı istemez | **Hayır** |
| Konum, kişiler, fotoğraflar, sağlık verisi | **Erişilmiyor** | **Hayır** |
| Kullanım analitiği, çökme raporu, reklam kimliği | **Toplanmıyor** | **Hayır** |

UMAI, App Store gizlilik etiketlerinde **"Veri Toplanmıyor"** olarak beyan
edilmiştir. Bu beyan, uygulamanın kaynak kodundaki `PrivacyInfo.xcprivacy`
manifestosu ile tutarlıdır.

## 4. Mesajlarınız nereye gider

Bir mesaj gönderdiğinizde, mesajınız ve o sohbetteki önceki mesajlar,
**sizin seçtiğiniz** yapay zekâ sağlayıcısına cihazınızdan doğrudan iletilir.
Seçebileceğiniz sağlayıcılar ve gizlilik politikaları:

- **Pollinations** (anahtarsız varsayılan) — https://pollinations.ai
- **Google Gemini** — https://policies.google.com/privacy
- **Groq** — https://groq.com/privacy-policy/
- **Cerebras** — https://www.cerebras.ai/privacy
- **OpenAI** — https://openai.com/policies/privacy-policy
- **Anthropic** — https://www.anthropic.com/legal/privacy
- **OpenRouter** — https://openrouter.ai/privacy

**Önemli:** Bu sağlayıcılara ilettiğiniz veriler, o sağlayıcının kendi gizlilik
politikasına tabidir. Sağlayıcılar verilerinizi model eğitimi için kullanabilir.
UMAI'nin bu işleme üzerinde kontrolü yoktur. Hassas veri (kişisel sağlık
bilgisi, kimlik numarası, şifre, müşteri verisi vb.) göndermemenizi öneririz.

Anahtarsız varsayılan sağlayıcı (Pollinations) kullanıldığında istek, bir API
anahtarı olmaksızın gönderilir; bu durumda sağlayıcı sizi kimliklendiremez ancak
IP adresinizi görebilir.

## 5. Git depolarınız

GitHub veya GitLab bağladığınızda, erişim anahtarınız cihazınızdaki Anahtar
Zinciri'nde saklanır ve yalnızca ilgili servise (api.github.com / gitlab.com)
gönderilir. UMAI depolarınıza **yalnızca okuma** yapar; hiçbir dosya yazmaz,
commit veya push etmez.

## 6. İşleme amacı ve hukuki sebep (KVKK md.5 / GDPR md.6)

Cihazınızda tutulan veriler, yalnızca uygulamanın çalışması (sohbetlerinizi
gösterebilmek, seçtiğiniz modeli hatırlamak) için işlenir. Hukuki sebep:
**sözleşmenin ifası** (KVKK md.5/2-c; GDPR md.6/1-b) ve **açık rızanız**
(uygulamayı ilk açtığınızda verdiğiniz onay).

Bu veriler cihazınızdan çıkmadığı için yurt dışına aktarım söz konusu değildir.
Ancak **mesajlarınızı gönderdiğiniz sağlayıcı yurt dışında bulunabilir**; bu
aktarımı başlatan sizin kendi eyleminizdir ve seçtiğiniz sağlayıcıyı
değiştirerek kontrol edebilirsiniz.

## 7. Saklama süresi

Verileriniz cihazınızda, siz silene kadar durur. Uygulamayı sildiğinizde
uygulama konteynerindeki tüm veriler (sohbetler, tercihler) iOS tarafından
silinir. Anahtar Zinciri kayıtları için **Ayarlar → Tüm verilerimi sil**
seçeneğini kullanmanızı öneririz.

## 8. Haklarınız (KVKK md.11 / GDPR md.15-22)

Verileriniz bizde bulunmadığı için erişim, düzeltme ve silme haklarınızı
**doğrudan cihazınızdan** kullanabilirsiniz:

- **Erişim / taşınabilirlik:** Sohbetler ekranından herhangi bir sohbeti
  Markdown olarak dışa aktarabilirsiniz.
- **Silme:** Tek tek sohbetleri kaydırarak silebilir; **Ayarlar → Tüm
  verilerimi sil** ile sohbetler, model profilleri ve Anahtar Zinciri'ndeki tüm
  anahtarları kalıcı olarak kaldırabilirsiniz.
- **Başvuru:** Yine de bir talebiniz varsa destek@umai.app adresine
  yazabilirsiniz. KVKK uyarınca başvurunuz **en geç 30 gün** içinde
  yanıtlanır. Yanıttan memnun kalmazsanız Kişisel Verileri Koruma Kurumu'na
  şikâyette bulunma hakkınız saklıdır.

## 9. Çocukların gizliliği

UMAI 13 yaşın altındaki çocuklara yönelik değildir ve bilerek bu yaş
grubundan veri toplamaz. Uygulama App Store'da yapay zekâ üretimi içerik
barındırdığı için ilgili yaş sınıflandırmasıyla yayımlanmaktadır.

## 10. Güvenlik

- API anahtarları iOS Anahtar Zinciri'nde,
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` korumasıyla saklanır:
  yedeklere girmez, başka bir cihaza aktarılmaz.
- Sohbet dosyası diske `.completeFileProtection` ile yazılır: cihaz kilitliyken
  şifreli kalır.
- Tüm ağ trafiği HTTPS/TLS üzerindendir.

Hiçbir sistem %100 güvenli değildir; cihazınızın kilit ekranı ve işletim
sistemi güncelliği güvenliğin önemli bir parçasıdır.

## 11. Değişiklikler

Bu politika değişirse uygulama içindeki metin güncellenir ve önemli
değişikliklerde yeniden onayınız istenir. Değişiklik tarihi bu belgenin başında
belirtilir.

## 12. İletişim

**destek@umai.app**
