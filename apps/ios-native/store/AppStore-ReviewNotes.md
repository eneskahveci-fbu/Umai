# App Store Connect — İnceleme Notları

> Bu metin, App Store Connect'teki **"Notes for Review"** alanına
> (İngilizcesiyle birlikte) yapıştırılmalıdır. Aşağıdaki maddeler, yapay zekâ
> uygulamalarının en sık reddedildiği noktalara **önceden** cevap verir.

---

## Türkçe

**UMAI nedir?**
UMAI, kullanıcının cihazında çalışan bir yapay zekâ sohbet/kodlama asistanı
istemcisidir. Kendi yapay zekâ modelimiz yoktur; kullanıcının seçtiği üçüncü
taraf sağlayıcıya (Pollinations, Google Gemini, Groq, Cerebras, OpenAI,
Anthropic, OpenRouter) istek gönderilir.

**Test için giriş bilgisi gerekmiyor.**
Uygulama hesap açmayı gerektirmez. İlk açılışta şartlar kabul edildikten sonra,
hiçbir ayar yapılmadan mesaj gönderilebilir: anahtarsız çalışan ücretsiz bir
sağlayıcı (Pollinations) gömülü olarak gelir.

**Guideline 1.2 (Kullanıcı Tarafından Üretilen İçerik) — nasıl karşılandı**
1. *Süzme:* Her isteğe güvenlik yönergesi eklenir (`ContentSafety.swift`),
   ayrıca en yüksek riskli talepler sağlayıcıya hiç gönderilmeden engellenir.
2. *Bildirme:* Her yapay zekâ yanıtının altında bayrak simgeli bir **bildir**
   düğmesi vardır. Bildirimler destek@umai.app adresine ulaşır ve 24 saat
   içinde değerlendirilir.
3. *Engelleme:* UMAI'de **kullanıcılar arası iletişim yoktur** — paylaşılan bir
   akış, mesajlaşma veya başka kullanıcıların içeriği bulunmaz. Tüm içerik
   yalnızca kullanıcının kendi cihazındadır. Bu nedenle "kullanıcı engelleme"
   kavramı üründe uygulanamaz; maddeyi atlamıyoruz, teknik olarak konusu yok.
4. *İletişim:* destek@umai.app hem uygulama içinde (Ayarlar → Yasal) hem de
   App Store sayfasında yayımlanmıştır.

**Guideline 2.5.2 (kod çalıştırma) — çalıştırmıyoruz**
UMAI kod **görüntüler ve kopyalar**, ancak indirilen veya üretilen hiçbir kodu
çalıştırmaz. Yorumlayıcı, eval, uzaktan kod yükleme veya betik motoru yoktur.

**Guideline 3.1.1 (uygulama içi satın alma) — satış yok**
Uygulama tamamen ücretsizdir, uygulama içi satın alma içermez ve dijital içerik
satmaz. Kullanıcı isterse kendi ücretsiz API anahtarını bağlayabilir; bu anahtar
ilgili sağlayıcıdan doğrudan alınır ve UMAI bu işlemde taraf değildir, komisyon
almaz.

**Guideline 5.1.1(v) (hesap silme) — hesap yok**
Uygulama hesap oluşturmaz, bu nedenle hesap silme akışı gerekmez. Yine de
**Ayarlar → Tüm verilerimi sil** ile cihazdaki tüm sohbetler, model profilleri
ve Anahtar Zinciri kayıtları kalıcı olarak silinebilir.

**Gizlilik**
Sunucumuz yoktur. Sohbetler ve API anahtarları yalnızca cihazda saklanır
(anahtarlar iOS Anahtar Zinciri'nde). Analitik, reklam ve izleme yoktur.
`PrivacyInfo.xcprivacy` manifestosunda "veri toplanmıyor" beyanı, App Store
gizlilik etiketleriyle birebir tutarlıdır.

**Şifreleme / ihracat uyumu**
Yalnızca platformun standart HTTPS/TLS'i kullanılır; özel şifreleme yoktur.
`ITSAppUsesNonExemptEncryption = false` olarak ayarlanmıştır.

**Git entegrasyonu salt-okunurdur**
GitHub/GitLab bağlantısı yalnızca depo listeler, dosya ağacını gösterir ve dosya
içeriğini okur. Yazma, commit veya push yapılmaz.

---

## English

**What is UMAI?**
UMAI is an on-device AI chat and coding assistant *client*. We do not host any
model. Requests go directly from the user's device to a third-party provider the
user chooses (Pollinations, Google Gemini, Groq, Cerebras, OpenAI, Anthropic,
OpenRouter).

**No demo account needed.** The app requires no sign-up. After accepting the
terms on first launch, the reviewer can send a message immediately — a keyless
free provider is bundled as the default.

**Guideline 1.2 (UGC) compliance**
1. *Filtering:* a safety system prompt is attached to every request
   (`ContentSafety.swift`); the highest-risk prompts are blocked before ever
   reaching a provider.
2. *Reporting:* every AI response has a flag button that files a report to
   destek@umai.app, reviewed within 24 hours.
3. *Blocking:* UMAI has **no user-to-user interaction** — no shared feed, no
   messaging, no content from other users. All content is local to the user's
   own device, so "blocking abusive users" has no subject matter in this
   product. We are not skipping the requirement; it is not applicable.
4. *Contact:* destek@umai.app is published in-app (Settings → Legal) and on the
   App Store listing.

**Guideline 2.5.2:** the app displays and copies code but never executes it. No
interpreter, no eval, no downloaded executable code.

**Guideline 3.1.1:** the app is free, has no in-app purchases, and sells no
digital content. Users may optionally connect their own free API key obtained
directly from a provider; UMAI is not a party to that and takes no commission.

**Guideline 5.1.1(v):** no accounts exist, so account deletion is not
applicable. Settings → "Delete all my data" permanently erases all local data
and Keychain entries.

**Privacy:** we operate no server. Chats and API keys never leave the device
(keys are stored in the iOS Keychain). No analytics, ads or tracking. The
`PrivacyInfo.xcprivacy` manifest declares no data collection, matching the App
Store privacy labels exactly.

**Export compliance:** only standard platform HTTPS/TLS is used;
`ITSAppUsesNonExemptEncryption = false`.
