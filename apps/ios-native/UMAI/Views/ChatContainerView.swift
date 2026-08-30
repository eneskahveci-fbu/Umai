import SwiftUI

/// Uygulamanın ana kabuğu: sohbet + geçmiş/ayarlar erişimi.
struct ChatContainerView: View {
    @EnvironmentObject private var store: ChatStore

    /// Görünüm modeli, ortamdaki GERÇEK store ile kurulur.
    ///
    /// Önce `init()` içinde `ChatViewModel(chat:store: ChatStore())` yazılmıştı;
    /// bu, kenarda ikinci bir depo örneği yaratıp diske de yazacaktı — sohbetler
    /// iki farklı yere kaydedilir, geçmiş tutarsız görünürdü. `@EnvironmentObject`
    /// init sırasında henüz okunamadığı için model `.task` içinde bağlanır.
    @State private var viewModel: ChatViewModel?

    @State private var showingHistory = false
    @State private var showingSettings = false
    @State private var reportTarget: ChatMessage?

    var body: some View {
        NavigationStack {
            Group {
                if let viewModel {
                    ChatScreen(viewModel: viewModel, onReport: { reportTarget = $0 })
                } else {
                    ProgressView()
                }
            }
                .navigationTitle(viewModel?.chat.messages.isEmpty == false ? (viewModel?.chat.title ?? "UMAI") : "UMAI")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { showingHistory = true } label: {
                            Image(systemName: "sidebar.left")
                        }
                        .accessibilityLabel("Sohbet geçmişi")
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button { newChat() } label: {
                            Image(systemName: "square.and.pencil")
                        }
                        .accessibilityLabel("Yeni sohbet")
                        Button { showingSettings = true } label: {
                            Image(systemName: "gearshape")
                        }
                        .accessibilityLabel("Ayarlar")
                    }
                }
        }
        .task {
            // Yalnız bir kez kur: her görünüm güncellemesinde yeni bir model
            // yaratmak, akan yanıtı ve yazılmakta olan metni sıfırlardı.
            guard viewModel == nil else { return }
            let chat = store.chats.first ?? store.createChat()
            viewModel = ChatViewModel(chat: chat, store: store)
        }
        .sheet(isPresented: $showingHistory) {
            ChatHistoryView { chat in
                viewModel?.chat = chat
                showingHistory = false
            }
        }
        .sheet(isPresented: $showingSettings) { SettingsView() }
        .sheet(item: $reportTarget) { message in
            ReportContentView(message: message)
        }
    }

    private func newChat() {
        viewModel?.chat = store.createChat()
        viewModel?.input = ""
    }
}

/// Sohbet ekranının kendisi (liste + composer).
struct ChatScreen: View {
    @ObservedObject var viewModel: ChatViewModel
    @EnvironmentObject private var store: ChatStore
    let onReport: (ChatMessage) -> Void

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.chat.messages.isEmpty {
                emptyState
            } else {
                messageList
            }

            if let note = viewModel.statusNote {
                Label(note, systemImage: "arrow.triangle.2.circlepath")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(.quaternary.opacity(0.3))
            }

            ComposerView(viewModel: viewModel)
        }
        .alert("Bir sorun oldu", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("Tamam", role: .cancel) { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    ForEach(viewModel.chat.messages) { message in
                        MessageView(message: message, onReport: onReport)
                            .id(message.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .onChange(of: viewModel.chat.messages.last?.content) { _, _ in
                withAnimation(.easeOut(duration: 0.15)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }

    /// Boş ekran: karşılama + (gerekiyorsa) "daha güçlü model bağla" daveti.
    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("Ne üzerinde çalışalım?")
                .font(.title2.weight(.bold))
            Text("Bir istek yaz, gerisini hallederim.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if store.isUsingOnlyKeylessDefault {
                NavigationLink {
                    ConnectModelView()
                } label: {
                    Label("Daha güçlü bir model bağla — ücretsiz", systemImage: "bolt.fill")
                        .font(.footnote)
                }
                .padding(.top, 8)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

/// Mesaj yazma alanı.
struct ComposerView: View {
    @ObservedObject var viewModel: ChatViewModel
    @FocusState private var focused: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Mesajını yaz…", text: $viewModel.input, axis: .vertical)
                .lineLimit(1...6)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.quaternary.opacity(0.35))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .focused($focused)
                .submitLabel(.send)

            if viewModel.isStreaming {
                Button(action: viewModel.stop) {
                    Image(systemName: "stop.circle.fill")
                        .font(.system(size: 30))
                }
                .accessibilityLabel("Yanıtı durdur")
            } else {
                Button(action: viewModel.send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                }
                .disabled(!viewModel.canSend)
                .accessibilityLabel("Gönder")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.bar)
    }
}
