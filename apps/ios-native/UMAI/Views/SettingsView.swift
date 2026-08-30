import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: ChatStore
    @Environment(\.dismiss) private var dismiss

    @State private var confirmingWipe = false
    @State private var showingDocument: LegalDocument?

    var body: some View {
        NavigationStack {
            Form {
                Section("Aktif model") {
                    ForEach(store.profiles) { profile in
                        Button {
                            store.setActive(profile.id)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(profile.label).foregroundStyle(.primary)
                                    Text(profile.model)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if profile.id == store.activeProfileID {
                                    Image(systemName: "checkmark").foregroundStyle(Color.umaiBrand)
                                }
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            if !profile.isKeylessDefault {
                                Button(role: .destructive) {
                                    store.removeProfile(profile.id)
                                } label: {
                                    Label("Sil", systemImage: "trash")
                                }
                            }
                        }
                    }
                    NavigationLink {
                        ConnectModelView()
                    } label: {
                        Label("Model bağla", systemImage: "plus.circle")
                    }
                }

                Section("Depolar") {
                    NavigationLink {
                        GitConnectView()
                    } label: {
                        Label("GitHub / GitLab bağla", systemImage: "chevron.left.forwardslash.chevron.right")
                    }
                }

                Section("Yasal") {
                    Button("Kullanım Şartları") { showingDocument = .terms }
                    Button("Gizlilik Politikası") { showingDocument = .privacy }
                    Button("Açık Kaynak Bildirimleri") { showingDocument = .licenses }
                    Link("Destek: \(ContentSafety.supportEmail)",
                         destination: URL(string: "mailto:\(ContentSafety.supportEmail)")!)
                }

                Section {
                    Button(role: .destructive) {
                        confirmingWipe = true
                    } label: {
                        Label("Tüm verilerimi sil", systemImage: "trash")
                    }
                } footer: {
                    Text("Sohbetlerin, model profillerin ve Anahtar Zinciri'ndeki API anahtarların bu cihazdan kalıcı olarak silinir. Sunucumuzda zaten hiçbir veri tutulmuyor.")
                }

                Section {
                    LabeledContent("Sürüm", value: Bundle.main.appVersion)
                }
            }
            .navigationTitle("Ayarlar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
            .sheet(item: $showingDocument) { LegalDocumentView(document: $0) }
            .alert("Tüm verilerin silinsin mi?", isPresented: $confirmingWipe) {
                Button("Sil", role: .destructive) { store.deleteAllUserData() }
                Button("Vazgeç", role: .cancel) {}
            } message: {
                Text("Bu işlem geri alınamaz.")
            }
        }
    }
}
