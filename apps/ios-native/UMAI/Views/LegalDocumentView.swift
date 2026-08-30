import SwiftUI

/// Uygulama içinde gösterilen hukuki belgeler.
///
/// NEDEN UYGULAMAYA GÖMÜLÜ, NEDEN WEB LİNKİ DEĞİL: App Store incelemesi
/// çevrimdışıyken de bu metinlere ulaşılmasını bekler; ayrıca bir web sayfası
/// sonradan değişebilir ve kullanıcının KABUL ETTİĞİ metinle uyuşmayabilir.
/// Gömülü kopya, kullanıcının onayladığı sürümün ta kendisidir.
enum LegalDocument: String, Identifiable, CaseIterable {
    case terms
    case privacy
    case licenses

    var id: String { rawValue }

    var title: String {
        switch self {
        case .terms: return "Kullanım Şartları"
        case .privacy: return "Gizlilik Politikası"
        case .licenses: return "Açık Kaynak Bildirimleri"
        }
    }

    /// Bundle içindeki dosya adı (Resources/Legal/).
    var resourceName: String {
        switch self {
        case .terms: return "Terms"
        case .privacy: return "PrivacyPolicy"
        case .licenses: return "Licenses"
        }
    }
}

struct LegalDocumentView: View {
    let document: LegalDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(loadMarkdown())
                    .font(.callout)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
            }
            .navigationTitle(document.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
    }

    /// Belgeyi bundle'dan okur.
    ///
    /// Dosya bulunamazsa BOŞ EKRAN gösterme: kullanıcı kabul etmesi istenen
    /// metni göremezse bu bir uyum sorunudur; ne olduğunu ve nereye
    /// yazılacağını söyleyen açık bir mesaj göster.
    private func loadMarkdown() -> AttributedString {
        guard
            let url = Bundle.main.url(forResource: document.resourceName, withExtension: "md", subdirectory: "Legal")
                ?? Bundle.main.url(forResource: document.resourceName, withExtension: "md"),
            let raw = try? String(contentsOf: url, encoding: .utf8)
        else {
            return AttributedString(
                "Belge yüklenemedi.\n\n\(document.resourceName).md dosyasının uygulama paketine (Resources/Legal) eklendiğinden emin ol.\n\nGüncel metin: \(ContentSafety.supportEmail)"
            )
        }
        return (try? AttributedString(markdown: raw, options: .init(
            interpretedSyntax: .full,
            failurePolicy: .returnPartiallyParsedIfPossible
        ))) ?? AttributedString(raw)
    }
}
