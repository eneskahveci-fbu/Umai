import SwiftUI

/// Markdown metnini düz paragraflara ve kod bloklarına ayırır.
///
/// SwiftUI'nin yerleşik `Text(markdown:)` desteği satır içi biçimlendirmeyi
/// (kalın, `kod`, bağlantı) çözer ama ÜÇ TIRNAKLI kod bloklarını çözmez —
/// blok olduğu gibi, tırnaklarıyla birlikte metne basılırdı. Bu ayrıştırıcı
/// blokları ayırıp her birini kendi görünümüne yollar.
enum MarkdownSegment: Identifiable, Equatable {
    case text(String)
    case code(language: String?, body: String)

    var id: String {
        switch self {
        case .text(let s): return "t:\(s.hashValue)"
        case .code(let lang, let body): return "c:\(lang ?? "")\(body.hashValue)"
        }
    }

    /// Metni segmentlere böler.
    ///
    /// Kapanış tırnağı OLMAYAN son blok da kurtarılır: model akış sırasında
    /// kesilirse kapanış hiç gelmez ve blok sabit-genişlik olarak değil, ham
    /// metin olarak görünürdü — yarım kod bloğu, hiç kod bloğu olmamasından
    /// iyidir.
    static func parse(_ markdown: String) -> [MarkdownSegment] {
        var segments: [MarkdownSegment] = []
        var currentText = ""
        var inCode = false
        var codeLanguage: String?
        var codeBody = ""

        for line in markdown.components(separatedBy: .newlines) {
            if line.hasPrefix("```") {
                if inCode {
                    segments.append(.code(language: codeLanguage, body: codeBody))
                    codeBody = ""
                    codeLanguage = nil
                    inCode = false
                } else {
                    if !currentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        segments.append(.text(currentText))
                    }
                    currentText = ""
                    let lang = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    codeLanguage = lang.isEmpty ? nil : lang
                    inCode = true
                }
                continue
            }
            if inCode {
                codeBody += codeBody.isEmpty ? line : "\n" + line
            } else {
                currentText += currentText.isEmpty ? line : "\n" + line
            }
        }

        if inCode, !codeBody.isEmpty {
            segments.append(.code(language: codeLanguage, body: codeBody))
        } else if !currentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            segments.append(.text(currentText))
        }
        return segments
    }
}

/// Kod bloğu: dil etiketi, kopyala düğmesi ve kaba sözdizimi renklendirmesi.
struct CodeBlockView: View {
    let language: String?
    let code: String

    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(language?.uppercased() ?? "KOD")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    UIPasteboard.general.string = code
                    copied = true
                    Task {
                        try? await Task.sleep(for: .seconds(2))
                        copied = false
                    }
                } label: {
                    Label(copied ? "Kopyalandı" : "Kopyala",
                          systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.caption2)
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.plain)
                .foregroundStyle(copied ? Color.umaiBrand : .secondary)
                .accessibilityLabel(copied ? "Kod kopyalandı" : "Kodu kopyala")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.quaternary.opacity(0.4))

            ScrollView(.horizontal, showsIndicators: false) {
                Text(SyntaxHighlighter.highlight(code, language: language))
                    .font(.system(.footnote, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(12)
            }
        }
        .background(.quaternary.opacity(0.18))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// Kaba, bağımlılıksız sözdizimi renklendirmesi.
///
/// Tam bir ayrıştırıcı DEĞİLDİR ve olmaya çalışmaz: telefonda okunabilirliği
/// artırmak için anahtar kelime / dizgi / yorum / sayı ayrımı yeter. Gerçek bir
/// renklendirici (tree-sitter vb.) MVP'ye orantısız bir bağımlılık ve boyut
/// getirirdi.
enum SyntaxHighlighter {

    private static let keywords: Set<String> = [
        // Swift / TS / JS / Python ortak kümesi
        "func", "let", "var", "if", "else", "guard", "return", "struct", "class",
        "enum", "protocol", "extension", "import", "for", "while", "switch", "case",
        "try", "catch", "throw", "async", "await", "static", "private", "public",
        "const", "function", "export", "default", "new", "type", "interface",
        "def", "elif", "None", "True", "False", "self", "in", "is", "not", "and", "or",
        "true", "false", "null", "nil", "this", "super", "init"
    ]

    static func highlight(_ code: String, language: String?) -> AttributedString {
        // Renkleri önce KARAKTER ARALIKLARI üzerinde topla, en sonda tek seferde
        // uygula.
        //
        // Önceki sürüm `AttributedString.range(of: <metin>)` kullanıyordu; o
        // fonksiyon metnin YALNIZCA İLK geçtiği yeri bulur. Sonuç: `let` on kez
        // geçse de yalnız ilki boyanır, üstelik ikinci `let`in rengi yanlış
        // yere düşerdi. Artık regex eşleşmesinin kendi konumu kullanılıyor.
        var colors: [(NSRange, Color)] = []
        let ns = code as NSString
        let full = NSRange(location: 0, length: ns.length)

        func addMatches(_ pattern: String, _ color: Color) {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
            for m in regex.matches(in: code, range: full) {
                colors.append((m.range, color))
            }
        }

        // Sıra önemli: dizgi ve yorumlar önce alınır, sonra gelen eşleşmeler
        // onların İÇİNE düşerse elenir (yorum içindeki "let" anahtar kelime değil).
        addMatches(#""[^"\n]*""#, .orange)
        addMatches(#"'[^'\n]*'"#, .orange)
        addMatches(#"//[^\n]*"#, .secondary)
        addMatches(#"#[^\n]*"#, .secondary)
        let protectedRanges = colors.map(\.0)

        var later: [(NSRange, Color)] = []
        func addLater(_ pattern: String, _ color: Color) {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
            for m in regex.matches(in: code, range: full) {
                let overlaps = protectedRanges.contains { NSIntersectionRange($0, m.range).length > 0 }
                if !overlaps { later.append((m.range, color)) }
            }
        }
        addLater(#"\b\d+(\.\d+)?\b"#, .purple)
        for keyword in keywords {
            addLater("\\b\(NSRegularExpression.escapedPattern(for: keyword))\\b", .pink)
        }

        var out = AttributedString(code)
        out.foregroundColor = .primary
        for (nsRange, color) in colors + later {
            guard
                let stringRange = Range(nsRange, in: code),
                let lower = AttributedString.Index(stringRange.lowerBound, within: out),
                let upper = AttributedString.Index(stringRange.upperBound, within: out)
            else { continue }
            out[lower..<upper].foregroundColor = color
        }
        return out
    }
}
