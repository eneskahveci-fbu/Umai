import Foundation

/// Sohbetlerin ve model profillerinin cihazdaki kalıcı deposu.
///
/// Sunucu YOK: her şey uygulamanın kendi konteynerindeki tek bir JSON
/// dosyasında durur. Bu, gizlilik politikasındaki "sohbetlerin cihazından
/// çıkmaz" iddiasının kod karşılığıdır.
@MainActor
final class ChatStore: ObservableObject {

    @Published private(set) var chats: [Chat] = []
    @Published private(set) var profiles: [ModelProfile] = []
    @Published var activeProfileID: UUID

    /// Kullanıcı EULA/içerik politikasını kabul etti mi (App Store 1.2 gereği).
    @Published private(set) var hasAcceptedTerms: Bool

    private let fileURL: URL
    private let defaults: UserDefaults

    private enum Keys {
        static let activeProfile = "umai.activeProfileID"
        static let acceptedTerms = "umai.acceptedTermsVersion"
    }

    /// Şartlar değişince yeniden onay istemek için sürüm numarası.
    static let currentTermsVersion = 1

    init(
        directory: URL? = nil,
        defaults: UserDefaults = .standard
    ) {
        let dir = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        self.fileURL = dir.appendingPathComponent("umai-store.json")
        self.defaults = defaults

        let storedActive = defaults.string(forKey: Keys.activeProfile).flatMap(UUID.init(uuidString:))
        self.activeProfileID = storedActive ?? ModelProfile.keylessDefault.id
        self.hasAcceptedTerms = defaults.integer(forKey: Keys.acceptedTerms) >= Self.currentTermsVersion

        load()
    }

    // MARK: - Kalıcılık

    private struct Snapshot: Codable {
        var chats: [Chat]
        var profiles: [ModelProfile]
    }

    private func load() {
        guard
            let data = try? Data(contentsOf: fileURL),
            let snapshot = try? JSONDecoder.umai.decode(Snapshot.self, from: data)
        else {
            // İlk açılış (ya da bozuk dosya): anahtarsız taban her zaman var olmalı
            // ki kullanıcı hiçbir şey ayarlamadan mesaj gönderebilsin.
            profiles = [.keylessDefault]
            return
        }
        chats = snapshot.chats
        profiles = snapshot.profiles.isEmpty ? [.keylessDefault] : snapshot.profiles
        if !profiles.contains(where: { $0.id == activeProfileID }) {
            activeProfileID = profiles[0].id
        }
    }

    private func persist() {
        let snapshot = Snapshot(chats: chats, profiles: profiles)
        guard let data = try? JSONEncoder.umai.encode(snapshot) else { return }
        // .completeFileProtection: cihaz kilitliyken dosya diskte şifreli kalır.
        try? data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }

    // MARK: - Sohbetler

    var activeProfile: ModelProfile? {
        profiles.first { $0.id == activeProfileID } ?? profiles.first
    }

    func chat(id: UUID) -> Chat? { chats.first { $0.id == id } }

    @discardableResult
    func createChat() -> Chat {
        let chat = Chat()
        chats.insert(chat, at: 0)
        persist()
        return chat
    }

    func upsert(_ chat: Chat) {
        var updated = chat
        updated.updatedAt = Date()
        if updated.title == "Yeni sohbet",
           let firstUser = updated.messages.first(where: { $0.role == .user }) {
            updated.title = Chat.derivedTitle(from: firstUser.content)
        }
        if let idx = chats.firstIndex(where: { $0.id == chat.id }) {
            chats[idx] = updated
        } else {
            chats.insert(updated, at: 0)
        }
        // En son dokunulan sohbet üstte.
        chats.sort { $0.updatedAt > $1.updatedAt }
        persist()
    }

    func delete(chatID: UUID) {
        chats.removeAll { $0.id == chatID }
        persist()
    }

    /// Başlıkta VE mesaj içeriğinde arama (büyük/küçük ve aksan duyarsız).
    ///
    /// `localizedCaseInsensitiveContains` Türkçe'de yetmiyor: "İ/ı" ve "ş/s"
    /// eşleşmesi için aksan duyarsız karşılaştırma şart — kullanıcı "sunucu"
    /// yazıp "Sunucü" başlıklı sohbeti bulamayınca arama bozuk sanılıyor.
    func search(_ query: String) -> [Chat] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return chats }
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
        return chats.filter { chat in
            if chat.title.range(of: q, options: options, locale: .current) != nil { return true }
            return chat.messages.contains { $0.content.range(of: q, options: options, locale: .current) != nil }
        }
    }

    /// Tek bir sohbeti Markdown olarak dışa aktarır (paylaş sayfası için).
    func exportMarkdown(chatID: UUID) -> String? {
        guard let chat = chat(id: chatID) else { return nil }
        var out = "# \(chat.title)\n\n"
        for m in chat.messages where m.role != .system {
            out += m.role == .user ? "## Sen\n\n" : "## UMAI\n\n"
            out += m.content + "\n\n"
        }
        return out
    }

    // MARK: - Model profilleri

    func addProfile(_ profile: ModelProfile, makeActive: Bool = true) {
        profiles.append(profile)
        if makeActive { setActive(profile.id) }
        persist()
    }

    func setActive(_ id: UUID) {
        activeProfileID = id
        defaults.set(id.uuidString, forKey: Keys.activeProfile)
    }

    func removeProfile(_ id: UUID) {
        guard let profile = profiles.first(where: { $0.id == id }) else { return }
        // Anahtarsız taban silinemez: fallback zincirinin son halkası ve
        // "asla limite çarpma" vaadinin dayanağı.
        guard !profile.isKeylessDefault else { return }
        if let ref = profile.keychainRef { try? KeychainStore.delete(ref: ref) }
        profiles.removeAll { $0.id == id }
        if activeProfileID == id, let first = profiles.first { setActive(first.id) }
        persist()
    }

    /// Kullanıcı hâlâ yalnızca anahtarsız tabanla mı çalışıyor?
    /// ("Daha güçlü model bağla" davetini göstermek için.)
    var isUsingOnlyKeylessDefault: Bool {
        profiles.allSatisfy(\.isKeylessDefault)
    }

    // MARK: - Şartlar

    func acceptTerms() {
        defaults.set(Self.currentTermsVersion, forKey: Keys.acceptedTerms)
        hasAcceptedTerms = true
    }

    // MARK: - Silme hakkı (KVKK md.7 / GDPR md.17)

    /// Uygulamadaki TÜM kullanıcı verisini siler: sohbetler, model profilleri ve
    /// Keychain'deki anahtarlar. Ayarlar'daki "Tüm verilerimi sil" buna bağlıdır.
    func deleteAllUserData() {
        chats = []
        for profile in profiles {
            if let ref = profile.keychainRef { try? KeychainStore.delete(ref: ref) }
        }
        try? KeychainStore.deleteAll()
        profiles = [.keylessDefault]
        setActive(ModelProfile.keylessDefault.id)
        try? FileManager.default.removeItem(at: fileURL)
        persist()
    }
}

extension JSONEncoder {
    static let umai: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

extension JSONDecoder {
    static let umai: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
