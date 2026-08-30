import SwiftUI

/// Git hesabı bağlama + depo gözatıcı.
///
/// MVP salt-okunurdur: depo listelenir, dosya ağacı gezilir, dosya içeriği
/// görüntülenir ve sohbete eklenebilir. Yazma/commit YOKTUR — ilk sürümde
/// kullanıcının deposuna zarar verme riskini sıfırda tutmak, özellik
/// eklemekten önemli.
struct GitConnectView: View {
    @AppStorage("umai.git.provider") private var providerRaw = GitProvider.github.rawValue
    @AppStorage("umai.git.keychainRef") private var keychainRef = ""

    @State private var token = ""
    @State private var error: String?
    @State private var repos: [GitRepo] = []
    @State private var loading = false

    private var provider: GitProvider { GitProvider(rawValue: providerRaw) ?? .github }
    private var isConnected: Bool { !keychainRef.isEmpty }

    var body: some View {
        Form {
            if !isConnected {
                Section("Sağlayıcı") {
                    Picker("Sağlayıcı", selection: $providerRaw) {
                        ForEach(GitProvider.allCases, id: \.rawValue) { p in
                            Text(p.displayName).tag(p.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    Link(destination: provider.tokenURL) {
                        Label("\(provider.displayName) token sayfasını aç", systemImage: "arrow.up.forward.square")
                    }
                    SecureField("Erişim anahtarı (token)", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Bağla") { connect() }
                        .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } footer: {
                    Text("Gereken yetki: \(provider.requiredScope). Token'ın yalnızca bu cihazdaki Anahtar Zinciri'nde saklanır. UMAI depolarına yalnızca OKUMA yapar; hiçbir şey yazmaz veya commit etmez.")
                }
            } else {
                Section("Depolar") {
                    if loading {
                        HStack { ProgressView(); Text("Yükleniyor…").foregroundStyle(.secondary) }
                    } else if repos.isEmpty {
                        Text("Depo bulunamadı.").foregroundStyle(.secondary)
                    } else {
                        ForEach(repos) { repo in
                            NavigationLink {
                                RepoBrowserView(
                                    service: GitService(provider: provider, keychainRef: keychainRef),
                                    repo: repo,
                                    branch: repo.defaultBranch,
                                    path: ""
                                )
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: repo.isPrivate ? "lock.fill" : "book.closed")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text(repo.fullName).font(.subheadline)
                                }
                            }
                        }
                    }
                }
                Section {
                    Button("Bağlantıyı kaldır", role: .destructive) { disconnect() }
                }
            }

            if let error {
                Section { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Depo bağla")
        .navigationBarTitleDisplayMode(.inline)
        .task { if isConnected, repos.isEmpty { await loadRepos() } }
    }

    private func connect() {
        let clean = token.trimmingCharacters(in: .whitespacesAndNewlines)
        let ref = "git.\(provider.rawValue).\(UUID().uuidString)"
        do {
            try KeychainStore.save(key: clean, ref: ref)
            keychainRef = ref
            token = ""
            error = nil
            Task { await loadRepos() }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func disconnect() {
        try? KeychainStore.delete(ref: keychainRef)
        keychainRef = ""
        repos = []
    }

    private func loadRepos() async {
        loading = true
        defer { loading = false }
        do {
            repos = try await GitService(provider: provider, keychainRef: keychainRef).listRepos()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Depo içi dosya gezgini.
struct RepoBrowserView: View {
    let service: GitService
    let repo: GitRepo
    let branch: String
    let path: String

    @State private var entries: [GitTreeEntry] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        List {
            if loading {
                HStack { ProgressView(); Text("Yükleniyor…").foregroundStyle(.secondary) }
            } else if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            } else {
                ForEach(entries) { entry in
                    if entry.isDirectory {
                        NavigationLink {
                            RepoBrowserView(service: service, repo: repo, branch: branch, path: entry.path)
                        } label: {
                            Label(entry.path.components(separatedBy: "/").last ?? entry.path,
                                  systemImage: "folder")
                        }
                    } else {
                        NavigationLink {
                            FileViewerView(service: service, repo: repo, branch: branch, path: entry.path)
                        } label: {
                            Label(entry.path.components(separatedBy: "/").last ?? entry.path,
                                  systemImage: "doc.text")
                        }
                    }
                }
            }
        }
        .navigationTitle(path.isEmpty ? repo.name : (path.components(separatedBy: "/").last ?? path))
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            entries = try await service.listTree(repo: repo, branch: branch, path: path)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Tek dosya görüntüleyici (salt-okunur, sözdizimi renklendirmeli).
struct FileViewerView: View {
    let service: GitService
    let repo: GitRepo
    let branch: String
    let path: String

    @State private var content: String?
    @State private var error: String?

    var body: some View {
        ScrollView {
            if let content {
                CodeBlockView(language: path.components(separatedBy: ".").last, code: content)
                    .padding(12)
            } else if let error {
                Text(error).font(.footnote).foregroundStyle(.red).padding()
            } else {
                ProgressView().padding(40)
            }
        }
        .navigationTitle(path.components(separatedBy: "/").last ?? path)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                content = try await service.readFile(repo: repo, branch: branch, path: path)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
