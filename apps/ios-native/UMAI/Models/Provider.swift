import Foundation

/// Desteklenen model sağlayıcıları.
///
/// Hepsi OpenAI-uyumlu `/chat/completions` sözleşmesini konuşur (Gemini'nin
/// OpenAI uyumluluk uç noktası dahil) — bu sayede tek bir istemci kodu tüm
/// sağlayıcılara yeter ve yeni bir sağlayıcı eklemek yalnızca bir katalog
/// girdisi demektir.
enum Provider: String, Codable, CaseIterable, Sendable {
    case pollinations   // anahtarsız, gömülü ücretsiz taban
    case gemini
    case groq
    case cerebras
    case openRouter
    case openAI
    case anthropic
    case custom
}

/// Bir sağlayıcının bağlantı bilgileri ve kullanıcıya dönük tanıtımı.
struct ProviderPreset: Identifiable, Sendable {
    var id: Provider { provider }
    let provider: Provider
    let displayName: String
    let baseURL: URL
    let defaultModel: String
    /// Anahtar gerekmiyorsa `nil`.
    let keyPrefix: String?
    /// Ücretsiz anahtarın alınacağı resmî sayfa (yalnız ücretsiz katmanlılar).
    let freeKeyURL: URL?
    /// Kullanıcıya "neden bunu seçeyim" cevabı — tek cümle, abartısız.
    let rationale: String
}

enum ProviderCatalog {

    /// Anahtarsız çalışan gömülü taban. Uygulama ilk açılışta bununla gelir:
    /// kullanıcı hiçbir şey ayarlamadan gerçek bir yanıt alabilmelidir.
    static let keylessDefault = ProviderPreset(
        provider: .pollinations,
        displayName: "UMAI Ücretsiz",
        baseURL: URL(string: "https://text.pollinations.ai/openai")!,
        defaultModel: "openai",
        keyPrefix: nil,
        freeKeyURL: nil,
        rationale: "Kurulum gerektirmez — hemen başlarsın."
    )

    /// Kullanıcının kendi ÜCRETSİZ anahtarıyla geçebileceği, belirgin şekilde
    /// daha güçlü seçenekler.
    ///
    /// Kabul kuralı: buraya yalnızca gerçekten ücretsiz katmanı olan ve
    /// **kredi kartı istemeyen** sağlayıcılar girer. Ücretli bir sağlayıcıyı
    /// "ücretsiz anahtar al" akışına koymak kullanıcıyı yanıltır.
    static let freeUpgrades: [ProviderPreset] = [
        ProviderPreset(
            provider: .gemini,
            displayName: "Google Gemini",
            baseURL: URL(string: "https://generativelanguage.googleapis.com/v1beta/openai")!,
            defaultModel: "gemini-2.0-flash",
            keyPrefix: "AIza",
            freeKeyURL: URL(string: "https://aistudio.google.com/apikey")!,
            rationale: "En dengeli ücretsiz seçenek — uzun bağlam, güçlü Türkçe."
        ),
        ProviderPreset(
            provider: .groq,
            displayName: "Groq",
            baseURL: URL(string: "https://api.groq.com/openai/v1")!,
            defaultModel: "llama-3.3-70b-versatile",
            keyPrefix: "gsk_",
            freeKeyURL: URL(string: "https://console.groq.com/keys")!,
            rationale: "Çok hızlı yanıt — anlık sohbet için en akıcısı."
        ),
        ProviderPreset(
            provider: .cerebras,
            displayName: "Cerebras",
            baseURL: URL(string: "https://api.cerebras.ai/v1")!,
            defaultModel: "llama-3.3-70b",
            keyPrefix: "csk-",
            freeKeyURL: URL(string: "https://cloud.cerebras.ai/platform/apikeys")!,
            rationale: "Yüksek hız, cömert ücretsiz kota."
        )
    ]

    /// Kendi ücretli anahtarını getirmek isteyenler için (ayarlarda, elle).
    static let bringYourOwn: [ProviderPreset] = [
        ProviderPreset(
            provider: .openAI,
            displayName: "OpenAI",
            baseURL: URL(string: "https://api.openai.com/v1")!,
            defaultModel: "gpt-4.1",
            keyPrefix: "sk-",
            freeKeyURL: nil,
            rationale: "Kendi OpenAI anahtarınla."
        ),
        ProviderPreset(
            provider: .anthropic,
            displayName: "Anthropic Claude",
            baseURL: URL(string: "https://api.anthropic.com/v1")!,
            defaultModel: "claude-sonnet-4-5",
            keyPrefix: "sk-ant-",
            freeKeyURL: nil,
            rationale: "Kendi Anthropic anahtarınla."
        ),
        ProviderPreset(
            provider: .openRouter,
            displayName: "OpenRouter",
            baseURL: URL(string: "https://openrouter.ai/api/v1")!,
            defaultModel: "openrouter/auto",
            keyPrefix: "sk-or-",
            freeKeyURL: URL(string: "https://openrouter.ai/keys")!,
            rationale: "Tek anahtarla çok sayıda modele erişim."
        )
    ]

    static var all: [ProviderPreset] {
        [keylessDefault] + freeUpgrades + bringYourOwn
    }

    static func preset(for provider: Provider) -> ProviderPreset? {
        all.first { $0.provider == provider }
    }
}
