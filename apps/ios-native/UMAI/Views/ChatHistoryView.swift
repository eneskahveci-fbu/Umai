import SwiftUI

/// Sohbet geçmişi: liste, arama, silme, dışa aktarma.
struct ChatHistoryView: View {
    @EnvironmentObject private var store: ChatStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    let onSelect: (Chat) -> Void

    private var results: [Chat] { store.search(query) }

    var body: some View {
        NavigationStack {
            Group {
                if results.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "Henüz sohbet yok" : "Sonuç bulunamadı",
                        systemImage: query.isEmpty ? "bubble.left.and.bubble.right" : "magnifyingglass",
                        description: Text(query.isEmpty
                                          ? "İlk mesajını gönderdiğinde burada görünecek."
                                          : "Farklı bir kelime dene.")
                    )
                } else {
                    List {
                        ForEach(results) { chat in
                            Button { onSelect(chat) } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(chat.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.primary)
                                        .lineLimit(1)
                                    Text(chat.updatedAt, format: .relative(presentation: .named))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    store.delete(chatID: chat.id)
                                } label: {
                                    Label("Sil", systemImage: "trash")
                                }
                                if let markdown = store.exportMarkdown(chatID: chat.id) {
                                    ShareLink(item: markdown) {
                                        Label("Paylaş", systemImage: "square.and.arrow.up")
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Sohbetlerde ara")
            .navigationTitle("Sohbetler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
    }
}
