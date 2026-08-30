import Foundation

/// Sağlayıcıdan gelen, kullanıcıya gösterilebilir hata.
///
/// Ham `429`/`503` göstermek güven kırıyordu: kullanıcı ne olduğunu da ne
/// yapacağını da anlamıyor. Her durum, NE OLDUĞUNU ve NE YAPILACAĞINI söyleyen
/// bir cümleye çevrilir.
enum ChatError: LocalizedError, Equatable {
    case noModelConfigured
    case rateLimited(provider: String)
    case unauthorized(provider: String)
    case serverUnavailable(provider: String, status: Int)
    case network(String)
    case allProvidersFailed
    case cancelled

    var errorDescription: String? {
        switch self {
        case .noModelConfigured:
            return "Önce bir model seç."
        case .rateLimited(let p):
            return "\(p) şu an yoğun (kota sınırı). Birazdan tekrar dene ya da Ayarlar'dan başka bir model bağla."
        case .unauthorized(let p):
            return "\(p) anahtarını kabul etmedi. Anahtarın süresi dolmuş ya da yanlış kopyalanmış olabilir — Ayarlar'dan güncelle."
        case .serverUnavailable(let p, let status):
            return "\(p) şu an yanıt vermiyor (\(status)). Birazdan tekrar dene."
        case .network(let detail):
            return "Bağlantı kurulamadı: \(detail)"
        case .allProvidersFailed:
            return "Hiçbir sağlayıcıya ulaşılamadı. İnternet bağlantını kontrol et."
        case .cancelled:
            return "İstek durduruldu."
        }
    }

    /// Bu hatada sıradaki sağlayıcıya geçmek anlamlı mı?
    ///
    /// Kota/erişim/sunucu hataları geçişi hak eder. Kullanıcının kendi
    /// durdurması ETMEZ — durdur'a basınca başka bir sağlayıcıda yeniden
    /// başlamak, kullanıcının istediğinin tam tersidir.
    var shouldFallback: Bool {
        switch self {
        case .rateLimited, .unauthorized, .serverUnavailable, .network: return true
        case .noModelConfigured, .allProvidersFailed, .cancelled: return false
        }
    }
}

/// Akışlı sohbet istemcisi (OpenAI-uyumlu `/chat/completions`, SSE).
struct ChatService {

    /// Fallback zincirini kurar: önce kullanıcının aktif modeli, sonra
    /// eklediği diğerleri, EN SONDA her zaman anahtarsız ücretsiz taban.
    ///
    /// Sondaki taban, ürünün "asla sert bir limitle karşılaşma" vaadidir:
    /// kullanıcının anahtarı tükense bile sohbet ölmez.
    static func fallbackChain(active: ModelProfile?, all: [ModelProfile]) -> [ModelProfile] {
        var chain: [ModelProfile] = []
        if let active { chain.append(active) }
        chain.append(contentsOf: all.filter { $0.id != active?.id })
        if !chain.contains(where: { $0.isKeylessDefault }) {
            chain.append(.keylessDefault)
        }
        return chain
    }

    /// Bir mesaj dizisi için akışlı yanıt üretir.
    ///
    /// Zincirdeki ilk sağlayıcı hata verirse sıradakine geçer. Akış BAŞLADIKTAN
    /// sonra hata olursa geçiş YAPILMAZ — kullanıcı yarım bir yanıt görmüşken
    /// metnin başka bir modelin çıktısıyla birleşmesi, sessizce bozuk bir yanıt
    /// üretirdi. O durumda eldeki kısım `isTruncated` ile işaretlenir.
    static func stream(
        messages: [ChatMessage],
        chain: [ModelProfile],
        systemPrompt: String,
        urlSession: URLSession = .shared
    ) -> AsyncThrowingStream<StreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                guard !chain.isEmpty else {
                    continuation.finish(throwing: ChatError.noModelConfigured)
                    return
                }

                var lastError: Error = ChatError.allProvidersFailed

                for profile in chain {
                    if Task.isCancelled {
                        continuation.finish(throwing: ChatError.cancelled)
                        return
                    }
                    do {
                        continuation.yield(.usingModel(profile.label))
                        try await streamOne(
                            profile: profile,
                            messages: messages,
                            systemPrompt: systemPrompt,
                            urlSession: urlSession,
                            continuation: continuation
                        )
                        continuation.finish()
                        return
                    } catch let error as ChatError where error.shouldFallback {
                        lastError = error
                        continuation.yield(.fallingBack(from: profile.label, reason: error.localizedDescription))
                        continue
                    } catch {
                        continuation.finish(throwing: error)
                        return
                    }
                }
                continuation.finish(throwing: lastError)
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - Tek sağlayıcı

    private static func streamOne(
        profile: ModelProfile,
        messages: [ChatMessage],
        systemPrompt: String,
        urlSession: URLSession,
        continuation: AsyncThrowingStream<StreamEvent, Error>.Continuation
    ) async throws {
        var request = URLRequest(url: profile.baseURL.appendingPathComponent("chat/completions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 120

        if let ref = profile.keychainRef, let key = try? KeychainStore.read(ref: ref), !key.isEmpty {
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        }

        var payloadMessages: [[String: String]] = [["role": "system", "content": systemPrompt]]
        payloadMessages += messages.map { ["role": $0.role.rawValue, "content": $0.content] }

        let body: [String: Any] = [
            "model": profile.model,
            "messages": payloadMessages,
            "stream": true
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response): (URLSession.AsyncBytes, URLResponse)
        do {
            (bytes, response) = try await urlSession.bytes(for: request)
        } catch is CancellationError {
            throw ChatError.cancelled
        } catch {
            throw ChatError.network(error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw mapStatus(http.statusCode, provider: profile.label)
        }

        var receivedAnything = false
        do {
            for try await line in bytes.lines {
                if Task.isCancelled { throw ChatError.cancelled }
                guard line.hasPrefix("data:") else { continue }

                let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                if payload == "[DONE]" { return }
                guard let data = payload.data(using: .utf8) else { continue }

                if let delta = parseDelta(data), !delta.isEmpty {
                    receivedAnything = true
                    continuation.yield(.token(delta))
                }
            }
        } catch let error as ChatError {
            throw error
        } catch {
            // Akış ORTASINDA koptu. Zaten metin gösterdiysek başka bir modele
            // geçmek iki farklı yanıtı birbirine yapıştırırdı; kesik olduğunu
            // söyleyip durmak dürüst olanı.
            if receivedAnything {
                continuation.yield(.truncated)
                return
            }
            throw ChatError.network(error.localizedDescription)
        }
    }

    private static func mapStatus(_ status: Int, provider: String) -> ChatError {
        switch status {
        case 401, 403: return .unauthorized(provider: provider)
        case 429: return .rateLimited(provider: provider)
        default: return .serverUnavailable(provider: provider, status: status)
        }
    }

    /// SSE parçasından metin deltasını çıkarır.
    ///
    /// `internal` (private değil) çünkü birim testleri bunu doğrudan sınar:
    /// sağlayıcılar biçimde küçük farklar gösteriyor ve bu ayrıştırıcı sessizce
    /// bozulursa sohbet "hiç yanıt gelmedi" gibi görünür.
    static func parseDelta(_ data: Data) -> String? {
        guard
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let choices = root["choices"] as? [[String: Any]],
            let first = choices.first
        else { return nil }

        if let delta = first["delta"] as? [String: Any], let content = delta["content"] as? String {
            return content
        }
        // Bazı sağlayıcılar akışın son parçasında `message` gönderiyor.
        if let message = first["message"] as? [String: Any], let content = message["content"] as? String {
            return content
        }
        return nil
    }

    enum StreamEvent: Sendable, Equatable {
        case usingModel(String)
        case fallingBack(from: String, reason: String)
        case token(String)
        case truncated
    }
}
