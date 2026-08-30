import SwiftUI

/// Sakıncalı bir yapay zekâ çıktısını bildirme ekranı.
///
/// App Store 1.2 gereği: yapay zekâ çıktısı üreten uygulamalarda kullanıcının
/// sakıncalı içeriği bildirebileceği ULAŞILABİLİR bir yol olmalıdır. Sunucumuz
/// olmadığı için bildirim, kullanıcının kendi e-posta istemcisiyle destek
/// adresine gider — kullanıcı gönderdiği metni görür ve vazgeçebilir.
struct ReportContentView: View {
    let message: ChatMessage

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var reason: ContentSafety.ReportReason = .harmful
    @State private var mailUnavailable = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Neden bildiriyorsun?") {
                    Picker("Neden", selection: $reason) {
                        ForEach(ContentSafety.ReportReason.allCases) { r in
                            Text(r.rawValue).tag(r)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Bildirilecek yanıt") {
                    Text(message.content.prefix(500))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button("Bildirimi gönder") { send() }
                } footer: {
                    Text("Bildirim, e-posta uygulamanda hazırlanır. Göndermeden önce içeriğini görebilir ve vazgeçebilirsin. Yalnızca yukarıdaki alıntı iletilir — sohbetinin tamamı gönderilmez.")
                }
            }
            .navigationTitle("İçerik bildir")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Vazgeç") { dismiss() }
                }
            }
            .alert("E-posta uygulaması bulunamadı", isPresented: $mailUnavailable) {
                Button("Tamam", role: .cancel) {}
            } message: {
                Text("Bildirimini doğrudan \(ContentSafety.supportEmail) adresine gönderebilirsin.")
            }
        }
    }

    private func send() {
        guard let url = ContentSafety.reportMailURL(
            reason: reason,
            excerpt: message.content,
            modelLabel: message.modelLabel,
            appVersion: Bundle.main.appVersion
        ) else {
            mailUnavailable = true
            return
        }
        openURL(url) { accepted in
            if accepted { dismiss() } else { mailUnavailable = true }
        }
    }
}
