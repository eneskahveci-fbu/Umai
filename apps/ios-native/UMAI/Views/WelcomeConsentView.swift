import SwiftUI

/// İlk açılış: karşılama + şartların kabulü.
///
/// App Store 1.2 ve 3.1.1 açısından burada üç şey NET olmalı:
///   • Yapay zekâ çıktısı hatalı olabilir (kullanıcı doğrulamalı).
///   • Hangi içeriğin yasak olduğu ve nasıl bildirileceği.
///   • Kullanıcının istemlerinin, seçtiği ÜÇÜNCÜ TARAF sağlayıcıya gittiği.
/// Üçüncüsü özellikle önemli: kullanıcı verisinin nereye gittiğini bilmeden
/// onay vermiş sayılmaz (KVKK md.10 aydınlatma / GDPR md.13).
struct WelcomeConsentView: View {
    @EnvironmentObject private var store: ChatStore
    @State private var showingTerms = false
    @State private var showingPrivacy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("UMAI")
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                    Text("Türkçe yapay zekâ kodlama asistanı")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 40)

                VStack(alignment: .leading, spacing: 16) {
                    point(
                        icon: "bolt.fill",
                        title: "Kurulum yok, ücretsiz başlar",
                        body: "Hesap açmadan, kart vermeden hemen kullanmaya başlarsın. İstersen kendi ücretsiz API anahtarınla çok daha güçlü bir modele geçebilirsin."
                    )
                    point(
                        icon: "lock.fill",
                        title: "Verilerin cihazında kalır",
                        body: "Sohbetlerin telefonundan çıkmaz. API anahtarların iOS Anahtar Zinciri'nde saklanır. Bizim sunucumuz yok."
                    )
                    point(
                        icon: "exclamationmark.triangle.fill",
                        title: "Yapay zekâ hata yapabilir",
                        body: "Üretilen yanıtlar yanlış veya eksik olabilir. Önemli kararlarda ve çalıştıracağın kodda mutlaka kendin doğrula."
                    )
                    point(
                        icon: "arrow.up.forward.app.fill",
                        title: "İstemlerin sağlayıcıya gider",
                        body: "Yazdığın mesajlar, seçtiğin model sağlayıcısına (Google, Groq, Cerebras vb.) gönderilir ve onların kendi gizlilik politikasına tabidir."
                    )
                    point(
                        icon: "flag.fill",
                        title: "Sakıncalı içeriği bildir",
                        body: "Her yanıtın altındaki bildir düğmesiyle sakıncalı bir çıktıyı bize iletebilirsin. Yasa dışı, cinsel, nefret içeren veya zarar verici içerik üretilmesi yasaktır."
                    )
                }

                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 16) {
                        Button("Kullanım Şartları") { showingTerms = true }
                        Button("Gizlilik Politikası") { showingPrivacy = true }
                    }
                    .font(.footnote)

                    Button {
                        store.acceptTerms()
                    } label: {
                        Text("Okudum, kabul ediyorum")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityHint("Kullanım şartlarını ve gizlilik politikasını kabul edip uygulamaya başlarsın.")

                    Text("Devam ederek Kullanım Şartları'nı ve Gizlilik Politikası'nı kabul etmiş olursun.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)
        }
        .sheet(isPresented: $showingTerms) {
            LegalDocumentView(document: .terms)
        }
        .sheet(isPresented: $showingPrivacy) {
            LegalDocumentView(document: .privacy)
        }
    }

    private func point(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.umaiBrand)
                .frame(width: 22)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(body).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }
}
