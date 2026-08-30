import SwiftUI

/// Tek bir mesaj balonu.
struct MessageView: View {
    let message: ChatMessage
    let onReport: (ChatMessage) -> Void

    @State private var copied = false

    var body: some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 48)
                Text(message.content)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.quaternary.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .textSelection(.enabled)
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(MarkdownSegment.parse(message.content)) { segment in
                    switch segment {
                    case .text(let body):
                        Text(inlineMarkdown(body))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    case .code(let language, let body):
                        CodeBlockView(language: language, code: body)
                    }
                }

                if message.isTruncated {
                    Label("Bu yanıt yarıda kesildi — eksik olabilir.", systemImage: "exclamationmark.triangle")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }

                if !message.content.isEmpty {
                    HStack(spacing: 14) {
                        if let label = message.modelLabel {
                            Text(label).font(.caption2).foregroundStyle(.tertiary)
                        }
                        Spacer()
                        Button {
                            UIPasteboard.general.string = message.content
                            copied = true
                            Task {
                                try? await Task.sleep(for: .seconds(2))
                                copied = false
                            }
                        } label: {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        }
                        .accessibilityLabel("Yanıtı kopyala")

                        // App Store 1.2: her yapay zekâ çıktısında ulaşılabilir
                        // bir bildirme yolu OLMALI.
                        Button {
                            onReport(message)
                        } label: {
                            Image(systemName: "flag")
                        }
                        .accessibilityLabel("Bu yanıtı bildir")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// Satır içi markdown (kalın, italik, `kod`, bağlantı).
    ///
    /// Ayrıştırma başarısız olursa metin KAYBOLMAMALI — düz metne düşülür.
    private func inlineMarkdown(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }
}
