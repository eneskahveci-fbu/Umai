import Foundation

/// İçerik güvenliği — App Store İnceleme Kılavuzu 1.2 (Kullanıcı Tarafından
/// Üretilen İçerik) uyumu.
///
/// NEDEN BU DOSYA VAR: Apple, model çıktısı üreten uygulamaları UGC kapsamında
/// değerlendirir ve DÖRT şeyi arar. Bunlar eksikse uygulama reddedilir — yapay
/// zekâ uygulamalarının en sık takıldığı madde budur:
///
///   1. Sakıncalı içeriği süzme yöntemi        → `safetySystemPrompt`
///   2. Sakıncalı içeriği bildirme mekanizması  → `ReportReason` + `reportMailURL`
///   3. Kötüye kullanan kullanıcıyı engelleme   → aşağıdaki nota bakınız
///   4. Yayımlanmış iletişim bilgisi            → `supportEmail`
///
/// (3) hakkında: UMAI'de kullanıcılar arası iletişim YOKTUR — kimse kimseye
/// içerik gönderemez, paylaşılan bir akış yoktur. "Engellenecek kullanıcı"
/// kavramı bu üründe bulunmaz. Bu, İnceleme Notları'nda açıkça yazılmalıdır
/// (bkz. store/AppStore-ReviewNotes.md); maddeyi görmezden gelmek değil,
/// neden uygulanamadığını göstermek gerekir.
enum ContentSafety {

    /// Yayımlanmış iletişim adresi (App Store Connect'teki destek adresiyle
    /// AYNI olmalı — tutarsızlık incelemede soru doğurur).
    static let supportEmail = "destek@umai.app"

    /// Her isteğe eklenen güvenlik yönergesi.
    ///
    /// Modelin kendi güvenlik katmanına ek bir kattır; sağlayıcı değişse bile
    /// (fallback zinciri farklı bir modele düşebilir) taban davranış korunur.
    static let safetySystemPrompt = """
    Sen UMAI'sin — Türkçe konuşan bir yazılım geliştirme asistanısın.

    İçerik kuralları:
    - Yasa dışı faaliyet, zarar verme talimatı, silah/patlayıcı yapımı, kötü
      amaçlı yazılım geliştirme veya bir sisteme izinsiz erişim taleplerini
      reddet. Reddederken kısa ve saygılı ol; ahlak dersi verme.
    - Cinsel içerik, nefret söylemi, taciz ve bir kişiyi hedef alan içerik üretme.
    - Reşit olmayanları içeren cinsel veya istismar edici hiçbir içeriği hiçbir
      gerekçeyle üretme.
    - Tıbbi, hukuki veya finansal konularda kesin hüküm verme; genel bilgi ver ve
      uzmana danışılmasını öner.
    - Emin olmadığın bilgiyi uydurma. Bilmiyorsan bilmediğini söyle.

    Yanıt biçimi:
    - Türkçe yanıt ver.
    - Kod bloklarında dili belirt.
    - Kısa ve doğrudan ol; gereksiz giriş cümlesi kurma.
    """

    /// Kullanıcının bir yanıtı neden bildirdiği.
    enum ReportReason: String, CaseIterable, Identifiable, Sendable {
        case harmful = "Zararlı veya tehlikeli"
        case sexual = "Cinsel içerik"
        case hateOrHarassment = "Nefret söylemi veya taciz"
        case misinformation = "Yanlış veya yanıltıcı bilgi"
        case other = "Diğer"

        var id: String { rawValue }
    }

    /// Bildirimi taşıyan e-posta bağlantısı.
    ///
    /// Sunucumuz olmadığı için bildirim, kullanıcının kendi e-posta istemcisi
    /// üzerinden destek adresine gider. Bu, App Store'un kabul ettiği bir
    /// yöntemdir ve "sunucuya veri göndermiyoruz" iddiasını da bozmaz:
    /// gönderim tamamen kullanıcının kontrolündedir, gönderdiği metni görür ve
    /// vazgeçebilir.
    ///
    /// - Parameter excerpt: Bildirilen yanıttan kısa bir alıntı. Sohbetin
    ///   TAMAMI gönderilmez — kullanıcının bildirmediği içeriği taşımak,
    ///   ihtiyacından fazla veri işlemek olurdu (veri minimizasyonu).
    static func reportMailURL(
        reason: ReportReason,
        excerpt: String,
        modelLabel: String?,
        appVersion: String
    ) -> URL? {
        let trimmed = String(excerpt.prefix(500))
        let body = """
        Bildirim nedeni: \(reason.rawValue)

        Yanıttan alıntı (ilk 500 karakter):
        \(trimmed)

        ---
        Model: \(modelLabel ?? "bilinmiyor")
        Uygulama sürümü: \(appVersion)
        Platform: iOS

        Not: Bu e-postayı göndermeden önce içeriğini düzenleyebilir veya
        gönderimden vazgeçebilirsin.
        """

        var components = URLComponents()
        components.scheme = "mailto"
        components.path = supportEmail
        components.queryItems = [
            URLQueryItem(name: "subject", value: "UMAI içerik bildirimi: \(reason.rawValue)"),
            URLQueryItem(name: "body", value: body)
        ]
        return components.url
    }

    /// Sağlayıcıya gönderilmeden ÖNCE istemi kaba bir süzgeçten geçirir.
    ///
    /// Bu bir moderasyon sistemi DEĞİLDİR ve öyle sunulmamalıdır — asıl süzme
    /// modelin kendi güvenlik katmanında olur. Buradaki amaç, en bariz ve en
    /// yüksek riskli talepleri sağlayıcıya hiç göndermeden durdurmak.
    /// Yanlış pozitifi olabildiğince az tutmak için desenler DAR tutulmuştur:
    /// meşru güvenlik/geliştirme sorularını engellemek, bu üründe zararlı
    /// içerikten daha sık karşılaşılacak bir hatadır.
    static func isObviouslyDisallowed(_ prompt: String) -> Bool {
        let normalized = prompt.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let blocked = [
            "cocuk pornografisi",
            "child porn",
            "csam",
            "bomba nasil yapilir",
            "how to make a bomb",
            "patlayici nasil yapilir"
        ]
        return blocked.contains { normalized.contains($0) }
    }

    /// Süzgece takılan isteme verilen yanıt.
    static let refusalMessage = """
    Bu isteği yerine getiremem.

    Başka bir konuda yardımcı olabilirim — kod yazma, hata ayıklama, bir metni
    açıklama gibi konularda sorabilirsin.
    """
}
