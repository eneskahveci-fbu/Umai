import Foundation

/// Bağlanabilen Git sağlayıcıları.
enum GitProvider: String, Codable, CaseIterable, Sendable {
    case github
    case gitlab

    var displayName: String { self == .github ? "GitHub" : "GitLab" }

    var apiBase: URL {
        switch self {
        case .github: return URL(string: "https://api.github.com")!
        case .gitlab: return URL(string: "https://gitlab.com/api/v4")!
        }
    }

    /// Kullanıcıya "token'ı nereden alırım" cevabı.
    var tokenURL: URL {
        switch self {
        case .github: return URL(string: "https://github.com/settings/tokens")!
        case .gitlab: return URL(string: "https://gitlab.com/-/user_settings/personal_access_tokens")!
        }
    }

    /// İstenen minimum yetki. MVP salt-okunur olduğu için yazma yetkisi
    /// İSTENMEZ: gereğinden fazla yetki istemek hem risk hem de App Store
    /// incelemesinde açıklanması gereken bir şey.
    var requiredScope: String {
        switch self {
        case .github: return "repo (salt-okunur erişim yeterli)"
        case .gitlab: return "read_api, read_repository"
        }
    }
}

struct GitRepo: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let name: String
    let fullName: String
    let defaultBranch: String
    let isPrivate: Bool
}

struct GitTreeEntry: Identifiable, Codable, Hashable, Sendable {
    var id: String { path }
    let path: String
    let isDirectory: Bool
    let size: Int?
}

enum GitError: LocalizedError {
    case notConnected
    case unauthorized(GitProvider)
    case notFound(String)
    case tooLarge(String)
    case server(Int)
    case network(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Önce bir Git hesabı bağla."
        case .unauthorized(let p):
            return "\(p.displayName) erişim anahtarını kabul etmedi. Süresi dolmuş ya da yetkisi yetersiz olabilir — Ayarlar'dan güncelle."
        case .notFound(let path):
            return "Bulunamadı: \(path)"
        case .tooLarge(let path):
            return "\(path) görüntülemek için fazla büyük."
        case .server(let status):
            return "Sunucu yanıt vermedi (\(status)). Birazdan tekrar dene."
        case .network(let detail):
            return "Bağlantı kurulamadı: \(detail)"
        }
    }
}

/// GitHub/GitLab salt-okunur istemcisi.
///
/// MVP bilinçli olarak YALNIZCA OKUR: depo listeler, dosya ağacını gezer,
/// dosya içeriği getirir. Yazma/commit yok — hem inceleme yüzeyini küçültür
/// hem de ilk sürümde kullanıcının deposuna zarar verme riskini sıfırlar.
struct GitService {

    /// Görüntülenecek dosyalar için üst sınır. Bunun üstü hem belleği şişirir
    /// hem de telefonda okunabilir değildir.
    static let maxFileBytes = 512 * 1024

    let provider: GitProvider
    let keychainRef: String
    var urlSession: URLSession = .shared

    private func authorizedRequest(_ url: URL) throws -> URLRequest {
        guard let token = try KeychainStore.read(ref: keychainRef), !token.isEmpty else {
            throw GitError.notConnected
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 30
        switch provider {
        case .github:
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
            req.setValue("2022-11-28", forHTTPHeaderField: "X-GitHub-Api-Version")
        case .gitlab:
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func run(_ request: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await urlSession.data(for: request)
            guard let http = response as? HTTPURLResponse else { return data }
            switch http.statusCode {
            case 200..<300: return data
            case 401, 403: throw GitError.unauthorized(provider)
            case 404: throw GitError.notFound(request.url?.lastPathComponent ?? "")
            default: throw GitError.server(http.statusCode)
            }
        } catch let error as GitError {
            throw error
        } catch {
            throw GitError.network(error.localizedDescription)
        }
    }

    /// Kullanıcının erişebildiği depolar (en son güncellenen önce).
    func listRepos() async throws -> [GitRepo] {
        switch provider {
        case .github:
            let url = provider.apiBase
                .appendingPathComponent("user/repos")
                .appending(queryItems: [
                    .init(name: "sort", value: "updated"),
                    .init(name: "per_page", value: "50")
                ])
            let data = try await run(try authorizedRequest(url))
            let raw = try JSONDecoder().decode([GitHubRepoDTO].self, from: data)
            return raw.map {
                GitRepo(id: String($0.id), name: $0.name, fullName: $0.full_name,
                        defaultBranch: $0.default_branch ?? "main", isPrivate: $0.private)
            }
        case .gitlab:
            let url = provider.apiBase
                .appendingPathComponent("projects")
                .appending(queryItems: [
                    .init(name: "membership", value: "true"),
                    .init(name: "order_by", value: "last_activity_at"),
                    .init(name: "per_page", value: "50")
                ])
            let data = try await run(try authorizedRequest(url))
            let raw = try JSONDecoder().decode([GitLabProjectDTO].self, from: data)
            return raw.map {
                GitRepo(id: String($0.id), name: $0.name, fullName: $0.path_with_namespace,
                        defaultBranch: $0.default_branch ?? "main", isPrivate: $0.visibility != "public")
            }
        }
    }

    /// Bir dizinin içeriği (tek seviye).
    func listTree(repo: GitRepo, branch: String, path: String = "") async throws -> [GitTreeEntry] {
        switch provider {
        case .github:
            var url = provider.apiBase
                .appendingPathComponent("repos/\(repo.fullName)/contents")
            if !path.isEmpty { url = url.appendingPathComponent(path) }
            url = url.appending(queryItems: [.init(name: "ref", value: branch)])
            let data = try await run(try authorizedRequest(url))
            let raw = try JSONDecoder().decode([GitHubContentDTO].self, from: data)
            return raw
                .map { GitTreeEntry(path: $0.path, isDirectory: $0.type == "dir", size: $0.size) }
                .sorted(by: treeOrder)
        case .gitlab:
            let url = provider.apiBase
                .appendingPathComponent("projects/\(encoded(repo.fullName))/repository/tree")
                .appending(queryItems: [
                    .init(name: "ref", value: branch),
                    .init(name: "path", value: path),
                    .init(name: "per_page", value: "100")
                ])
            let data = try await run(try authorizedRequest(url))
            let raw = try JSONDecoder().decode([GitLabTreeDTO].self, from: data)
            return raw
                .map { GitTreeEntry(path: $0.path, isDirectory: $0.type == "tree", size: nil) }
                .sorted(by: treeOrder)
        }
    }

    /// Dosya içeriği (metin).
    func readFile(repo: GitRepo, branch: String, path: String) async throws -> String {
        switch provider {
        case .github:
            let url = provider.apiBase
                .appendingPathComponent("repos/\(repo.fullName)/contents")
                .appendingPathComponent(path)
                .appending(queryItems: [.init(name: "ref", value: branch)])
            var req = try authorizedRequest(url)
            // raw: base64 çözmeye gerek kalmaz, bellek de yarı yarıya iner.
            req.setValue("application/vnd.github.raw", forHTTPHeaderField: "Accept")
            let data = try await run(req)
            guard data.count <= Self.maxFileBytes else { throw GitError.tooLarge(path) }
            return String(data: data, encoding: .utf8) ?? ""
        case .gitlab:
            let url = provider.apiBase
                .appendingPathComponent("projects/\(encoded(repo.fullName))/repository/files/\(encoded(path))/raw")
                .appending(queryItems: [.init(name: "ref", value: branch)])
            let data = try await run(try authorizedRequest(url))
            guard data.count <= Self.maxFileBytes else { throw GitError.tooLarge(path) }
            return String(data: data, encoding: .utf8) ?? ""
        }
    }

    /// Klasörler önce, sonra alfabetik — telefonda gezinmeyi öngörülebilir yapar.
    private func treeOrder(_ a: GitTreeEntry, _ b: GitTreeEntry) -> Bool {
        if a.isDirectory != b.isDirectory { return a.isDirectory }
        return a.path.localizedStandardCompare(b.path) == .orderedAscending
    }

    /// GitLab yol parametreleri URL-encode edilmiş olmalı ("/" → "%2F").
    private func encoded(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? s
    }
}

// MARK: - Ağ DTO'ları

private struct GitHubRepoDTO: Decodable {
    let id: Int
    let name: String
    let full_name: String
    let `private`: Bool
    let default_branch: String?
}

private struct GitHubContentDTO: Decodable {
    let path: String
    let type: String
    let size: Int?
}

private struct GitLabProjectDTO: Decodable {
    let id: Int
    let name: String
    let path_with_namespace: String
    let visibility: String?
    let default_branch: String?
}

private struct GitLabTreeDTO: Decodable {
    let path: String
    let type: String
}
