import SwiftUI

/// "Daha güçlü bir model bağla" köprüsü.
///
/// Ürünün en güçlü kozu, kullanıcının kendi ÜCRETSİZ anahtarıyla çok daha
/// güçlü bir modele geçebilmesi. Bu ekran o yolu iki adıma indirir:
/// anahtarı al → yapıştır. Hiçbir şeyi kilitlemez; kullanıcı anahtarsız
/// tabanla sonsuza kadar devam edebilir.
struct ConnectModelView: View {
    @EnvironmentObject private var store: ChatStore
    @Environment(\.dismiss) private var dismiss

    @State private var selected: ProviderPreset?
    @State private var key = ""
    @State private var warning: String?
    @State private var saveError: String?

    var body: some View {
        Form {
            Section {
                Text("Aşağıdakilerin hepsi ücretsiz ve kredi kartı istemiyor. Anahtarın yalnızca bu cihazdaki iOS Anahtar Zinciri'nde saklanır; bize gönderilmez.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if let preset = selected {
                Section("1. Ücretsiz anahtarı al") {
                    if let url = preset.freeKeyURL {
                        Link(destination: url) {
                            Label("\(preset.displayName) anahtar sayfasını aç", systemImage: "arrow.up.forward.square")
                        }
                    }
                }
                Section("2. Anahtarı yapıştır") {
                    SecureField(preset.keyPrefix.map { "\($0)…" } ?? "API anahtarı", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    if let warning {
                        Text(warning).font(.caption).foregroundStyle(.orange)
                    }
                }
                Section {
                    Button("Bağla ve kullan") { connect(preset) }
                        .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button("Başka sağlayıcı seç") {
                        selected = nil
                        key = ""
                        warning = nil
                    }
                    .foregroundStyle(.secondary)
                }
            } else {
                Section("Ücretsiz seçenekler") {
                    ForEach(ProviderCatalog.freeUpgrades) { preset in
                        Button { selected = preset } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(preset.displayName)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(preset.rationale)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section("Kendi ücretli anahtarın") {
                    ForEach(ProviderCatalog.bringYourOwn) { preset in
                        Button { selected = preset } label: {
                            Text(preset.displayName).foregroundStyle(.primary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Model bağla")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Anahtar kaydedilemedi", isPresented: .init(
            get: { saveError != nil }, set: { if !$0 { saveError = nil } }
        )) {
            Button("Tamam", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private func connect(_ preset: ProviderPreset) {
        let clean = KeyValidator.normalize(key)

        switch KeyValidator.check(clean, expectedPrefix: preset.keyPrefix, providerName: preset.displayName) {
        case .blocking(let reason):
            warning = reason
            return
        case .advisory(let reason):
            // Ön ek uyuşmazlığı ENGEL DEĞİL: sağlayıcılar ön eklerini zamanla
            // değiştiriyor ve geçerli bir anahtarı reddetmek, uyarmaktan çok
            // daha kötü bir hata olurdu.
            warning = reason
        case .ok:
            warning = nil
        }

        let ref = KeychainStore.makeRef(for: preset.provider)
        do {
            try KeychainStore.save(key: clean, ref: ref)
        } catch {
            saveError = error.localizedDescription
            return
        }

        store.addProfile(
            ModelProfile(
                label: preset.displayName,
                provider: preset.provider,
                baseURL: preset.baseURL,
                model: preset.defaultModel,
                keychainRef: ref
            )
        )
        dismiss()
    }
}

/// Yapıştırılan anahtarın temizlenmesi ve kaba biçim kontrolü.
///
/// Görünümden ayrı tutuluyor ki birim testleri doğrudan sınayabilsin.
enum KeyValidator {

    enum Result: Equatable {
        case ok
        /// Kaydetmeyi ENGELLER (bariz olarak anahtar değil).
        case blocking(String)
        /// Yalnızca uyarır, kaydetmeye devam edilir.
        case advisory(String)
    }

    /// Görünmez boşluklar, tırnaklar ve kopyalanan `ANAHTAR=` öneklerini atar.
    static func normalize(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.trimmingCharacters(in: CharacterSet(charactersIn: "\"'`"))
        if let eq = s.firstIndex(of: "="),
           s[s.startIndex..<eq].allSatisfy({ $0.isUppercase || $0 == "_" || $0.isWhitespace }) {
            s = String(s[s.index(after: eq)...])
        }
        return s.components(separatedBy: .whitespacesAndNewlines).joined()
    }

    static func check(_ key: String, expectedPrefix: String?, providerName: String) -> Result {
        if key.isEmpty { return .blocking("Anahtar boş.") }
        if key.count < 12 { return .blocking("Bu bir API anahtarı için fazla kısa.") }
        if key.lowercased().hasPrefix("http") { return .blocking("Bu bir adres — anahtarın kendisini yapıştır.") }
        if key.contains("@"), key.contains(".") { return .blocking("Bu bir e-posta adresi gibi görünüyor.") }
        if let prefix = expectedPrefix, !key.hasPrefix(prefix) {
            return .advisory("\(providerName) anahtarları genelde “\(prefix)” ile başlar — yine de deneyebilirsin.")
        }
        return .ok
    }
}
