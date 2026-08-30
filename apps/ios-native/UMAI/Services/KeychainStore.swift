import Foundation
import Security

/// API anahtarlarının saklandığı yer.
///
/// NEDEN KEYCHAIN, NEDEN UserDefaults DEĞİL:
/// Gizlilik politikamız "anahtarların cihazında güvenle saklanır" diyor.
/// UserDefaults düz bir plist'tir; yedeklere girer ve jailbreak'li/erişimi olan
/// bir cihazda düz metin okunur. Bu iddiayı ancak Keychain karşılar. Ayrıca
/// `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` ile anahtarlar
/// yedeklere ve başka cihaza ASLA taşınmaz — kullanıcı iCloud yedeğini başka
/// bir telefona açsa bile anahtarları oraya gitmez.
enum KeychainStore {

    enum KeychainError: LocalizedError {
        case unexpectedStatus(OSStatus)
        case invalidData

        var errorDescription: String? {
            switch self {
            case .unexpectedStatus(let status):
                let msg = SecCopyErrorMessageString(status, nil) as String? ?? "bilinmeyen"
                return "Anahtar zinciri hatası (\(status)): \(msg)"
            case .invalidData:
                return "Anahtar okunamadı — kayıt bozuk görünüyor."
            }
        }
    }

    private static let service = "com.umai.app.providerKeys"

    /// Yeni bir profil için benzersiz Keychain referansı üretir.
    static func makeRef(for provider: Provider) -> String {
        "\(provider.rawValue).\(UUID().uuidString)"
    }

    static func save(key: String, ref: String) throws {
        guard let data = key.data(using: .utf8) else { throw KeychainError.invalidData }

        // Önce var olanı sil: SecItemAdd yinelenen kayıtta errSecDuplicateItem
        // döndürür ve "güncelle" niyetini sessizce başarısız kılar.
        try? delete(ref: ref)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: ref,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
    }

    static func read(ref: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: ref,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
        guard let data = item as? Data, let key = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        return key
    }

    static func delete(ref: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: ref
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    /// "Tüm verilerimi sil" akışının anahtar ayağı (KVKK/GDPR silme hakkı).
    static func deleteAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
