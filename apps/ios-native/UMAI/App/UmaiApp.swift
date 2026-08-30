import SwiftUI

@main
struct UmaiApp: App {
    @StateObject private var store = ChatStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(.umaiBrand)
        }
    }
}

/// Kök görünüm.
///
/// Şartlar kabul edilmeden sohbet ekranı açılmaz. Bu bir "karanlık desen"
/// değil, App Store 1.2 gereğidir: kullanıcı, yapay zekâ çıktısının hatalı
/// olabileceğini ve hangi içeriğin yasak olduğunu KULLANMADAN ÖNCE görmelidir.
struct RootView: View {
    @EnvironmentObject private var store: ChatStore

    var body: some View {
        Group {
            if store.hasAcceptedTerms {
                ChatContainerView()
            } else {
                WelcomeConsentView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: store.hasAcceptedTerms)
    }
}

extension Color {
    /// Marka rengi — web uygulamasındaki vurgu yeşiliyle aynı.
    static let umaiBrand = Color(red: 0.13, green: 0.90, blue: 0.60)
}

extension Bundle {
    var appVersion: String {
        let short = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }
}
