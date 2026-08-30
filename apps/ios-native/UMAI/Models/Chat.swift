import Foundation

/// Sohbetteki tek bir mesaj.
struct ChatMessage: Identifiable, Codable, Hashable, Sendable {
    enum Role: String, Codable, Sendable {
        case user
        case assistant
        case system
    }

    let id: UUID
    var role: Role
    var content: String
    var createdAt: Date
    /// Bu yanıtı hangi model üretti (geçmişte "neyi neyle ürettim" sorusu için).
    var modelLabel: String?
    /// Yanıt yarıda kesildiyse (kullanıcı durdurdu / ağ koptu) işaretlenir —
    /// kullanıcı eksik bir metne tam yanıt sanıp güvenmemeli.
    var isTruncated: Bool

    init(
        id: UUID = UUID(),
        role: Role,
        content: String,
        createdAt: Date = Date(),
        modelLabel: String? = nil,
        isTruncated: Bool = false
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.modelLabel = modelLabel
        self.isTruncated = isTruncated
    }
}

/// Bir sohbet oturumu. Yalnızca cihazda saklanır (bkz. ChatStore).
struct Chat: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        title: String = "Yeni sohbet",
        messages: [ChatMessage] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.messages = messages
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// İlk kullanıcı mesajından okunabilir bir başlık türetir.
    ///
    /// Satır sonlarını boşluğa çevirir ve KELİME sınırında keser — ham `prefix`
    /// kelimeyi ortadan bölüp ("React'te useEff…") listeyi çirkinleştiriyordu.
    static func derivedTitle(from text: String, limit: Int = 40) -> String {
        let flat = text
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !flat.isEmpty else { return "Yeni sohbet" }
        guard flat.count > limit else { return flat }

        let cut = flat.prefix(limit)
        if let lastSpace = cut.lastIndex(of: " "), cut.distance(from: cut.startIndex, to: lastSpace) > limit / 2 {
            return String(cut[..<lastSpace]) + "…"
        }
        return String(cut) + "…"
    }
}

/// Kullanıcının bağladığı bir model profili.
///
/// DİKKAT: `apiKey` burada YOK. Anahtarlar Keychain'de saklanır (KeychainStore)
/// ve bu yapı `Codable` olarak diske yazıldığı için anahtarı buraya koymak,
/// gizlilik politikasındaki "anahtarlar Keychain'de" iddiasını sessizce
/// yalanlardı. Anahtar `keychainRef` ile aranır.
struct ModelProfile: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var label: String
    var provider: Provider
    var baseURL: URL
    var model: String
    /// Keychain'deki kaydın anahtarı. Anahtar gerekmiyorsa `nil`.
    var keychainRef: String?
    var addedAt: Date

    init(
        id: UUID = UUID(),
        label: String,
        provider: Provider,
        baseURL: URL,
        model: String,
        keychainRef: String? = nil,
        addedAt: Date = Date()
    ) {
        self.id = id
        self.label = label
        self.provider = provider
        self.baseURL = baseURL
        self.model = model
        self.keychainRef = keychainRef
        self.addedAt = addedAt
    }

    /// Anahtarsız gömülü taban profili.
    static let keylessDefault = ModelProfile(
        id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
        label: ProviderCatalog.keylessDefault.displayName,
        provider: .pollinations,
        baseURL: ProviderCatalog.keylessDefault.baseURL,
        model: ProviderCatalog.keylessDefault.defaultModel,
        keychainRef: nil
    )

    /// Kullanıcının kendi eklemediği, anahtarsız gömülü varsayılan mı?
    var isKeylessDefault: Bool {
        provider == .pollinations && keychainRef == nil
    }
}
