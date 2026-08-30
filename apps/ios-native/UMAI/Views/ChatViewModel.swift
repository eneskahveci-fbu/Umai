import Foundation
import SwiftUI

/// Tek bir sohbetin durumu ve akış yönetimi.
@MainActor
final class ChatViewModel: ObservableObject {

    @Published var chat: Chat
    @Published var input: String = ""
    @Published private(set) var isStreaming = false
    @Published private(set) var statusNote: String?
    @Published var errorMessage: String?

    private let store: ChatStore
    private var streamTask: Task<Void, Never>?

    init(chat: Chat, store: ChatStore) {
        self.chat = chat
        self.store = store
    }

    var canSend: Bool {
        !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming
    }

    func send() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isStreaming else { return }

        // Sağlayıcıya gitmeden önce kaba güvenlik süzgeci (App Store 1.2).
        if ContentSafety.isObviouslyDisallowed(text) {
            chat.messages.append(ChatMessage(role: .user, content: text))
            chat.messages.append(ChatMessage(role: .assistant, content: ContentSafety.refusalMessage))
            input = ""
            store.upsert(chat)
            return
        }

        chat.messages.append(ChatMessage(role: .user, content: text))
        input = ""
        store.upsert(chat)
        startStream()
    }

    /// Son asistan yanıtını silip yeniden üretir.
    func regenerate() {
        guard !isStreaming else { return }
        if chat.messages.last?.role == .assistant { chat.messages.removeLast() }
        store.upsert(chat)
        startStream()
    }

    func stop() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
        statusNote = nil
        // Yarıda kesilen yanıt işaretlenir: kullanıcı eksik metni tam yanıt
        // sanıp güvenmemeli.
        if var last = chat.messages.last, last.role == .assistant {
            last.isTruncated = true
            chat.messages[chat.messages.count - 1] = last
            store.upsert(chat)
        }
    }

    private func startStream() {
        let chain = ChatService.fallbackChain(active: store.activeProfile, all: store.profiles)
        let history = chat.messages.filter { $0.role != .system }

        isStreaming = true
        errorMessage = nil
        statusNote = nil

        // Akış için boş bir asistan mesajı: kullanıcı ANINDA bir yer tutucu görür.
        chat.messages.append(ChatMessage(role: .assistant, content: ""))

        streamTask = Task { [weak self] in
            guard let self else { return }
            do {
                for try await event in ChatService.stream(
                    messages: history,
                    chain: chain,
                    systemPrompt: ContentSafety.safetySystemPrompt
                ) {
                    if Task.isCancelled { break }
                    switch event {
                    case .usingModel(let label):
                        self.setLastModelLabel(label)
                    case .fallingBack(let from, _):
                        // Sessizce geçmek yerine SÖYLE: kullanıcı neden başka bir
                        // modelin yanıtladığını bilmeli.
                        self.statusNote = "\(from) yanıt vermedi, sıradaki modele geçiliyor…"
                    case .token(let piece):
                        self.appendToLast(piece)
                    case .truncated:
                        self.markLastTruncated()
                    }
                }
                self.finish()
            } catch {
                self.fail(with: error)
            }
        }
    }

    private func appendToLast(_ piece: String) {
        guard var last = chat.messages.last, last.role == .assistant else { return }
        last.content += piece
        chat.messages[chat.messages.count - 1] = last
    }

    private func setLastModelLabel(_ label: String) {
        guard var last = chat.messages.last, last.role == .assistant else { return }
        last.modelLabel = label
        chat.messages[chat.messages.count - 1] = last
    }

    private func markLastTruncated() {
        guard var last = chat.messages.last, last.role == .assistant else { return }
        last.isTruncated = true
        chat.messages[chat.messages.count - 1] = last
    }

    private func finish() {
        isStreaming = false
        statusNote = nil
        streamTask = nil
        // Hiç içerik gelmediyse boş balon bırakma.
        if let last = chat.messages.last, last.role == .assistant, last.content.isEmpty {
            chat.messages.removeLast()
        }
        store.upsert(chat)
    }

    private func fail(with error: Error) {
        isStreaming = false
        statusNote = nil
        streamTask = nil
        if let last = chat.messages.last, last.role == .assistant, last.content.isEmpty {
            chat.messages.removeLast()
        }
        if let chatError = error as? ChatError, chatError == .cancelled { return }
        errorMessage = error.localizedDescription
        store.upsert(chat)
    }
}
