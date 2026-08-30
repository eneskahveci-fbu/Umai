import XCTest
@testable import UMAI

/// Saf mantık testleri.
///
/// Arayüzden ayrı tutulan her şey burada sınanır: akış ayrıştırıcı, fallback
/// zinciri, başlık türetme, anahtar doğrulama, markdown bölme ve içerik
/// güvenliği. Bunlar bozulduğunda hata GÖRÜNMEZ olur (sohbet "yanıt gelmedi"
/// gibi davranır), o yüzden testle kilitlenmeleri önemli.
final class CoreLogicTests: XCTestCase {

    // MARK: - SSE ayrıştırma

    func testParseDeltaReadsStreamingContent() {
        let json = #"{"choices":[{"delta":{"content":"merhaba"}}]}"#.data(using: .utf8)!
        XCTAssertEqual(ChatService.parseDelta(json), "merhaba")
    }

    func testParseDeltaFallsBackToMessageShape() {
        // Bazı sağlayıcılar son parçada `delta` yerine `message` gönderiyor.
        let json = #"{"choices":[{"message":{"content":"son"}}]}"#.data(using: .utf8)!
        XCTAssertEqual(ChatService.parseDelta(json), "son")
    }

    func testParseDeltaReturnsNilForUnrelatedPayload() {
        let json = #"{"choices":[{"finish_reason":"stop"}]}"#.data(using: .utf8)!
        XCTAssertNil(ChatService.parseDelta(json))
        XCTAssertNil(ChatService.parseDelta(Data("bozuk".utf8)))
    }

    // MARK: - Fallback zinciri

    func testFallbackChainAlwaysEndsWithKeylessDefault() {
        // "Asla sert bir limitle karşılaşma" vaadi buna dayanıyor: kullanıcının
        // anahtarı tükense bile sohbet ölmemeli.
        let gemini = ModelProfile(label: "Gemini", provider: .gemini,
                                  baseURL: URL(string: "https://example.com")!,
                                  model: "g", keychainRef: "ref")
        let chain = ChatService.fallbackChain(active: gemini, all: [gemini])
        XCTAssertEqual(chain.first?.id, gemini.id)
        XCTAssertTrue(chain.last?.isKeylessDefault == true)
    }

    func testFallbackChainDoesNotDuplicateKeylessDefault() {
        let chain = ChatService.fallbackChain(active: .keylessDefault, all: [.keylessDefault])
        XCTAssertEqual(chain.filter(\.isKeylessDefault).count, 1)
    }

    func testCancelledErrorDoesNotTriggerFallback() {
        // Kullanıcı "durdur"a bastığında başka bir sağlayıcıda yeniden başlamak,
        // istediğinin tam tersi olurdu.
        XCTAssertFalse(ChatError.cancelled.shouldFallback)
        XCTAssertTrue(ChatError.rateLimited(provider: "X").shouldFallback)
        XCTAssertTrue(ChatError.unauthorized(provider: "X").shouldFallback)
    }

    // MARK: - Başlık türetme

    func testDerivedTitleCutsAtWordBoundary() {
        let long = "React uygulamasinda useEffect bagimlilik dizisi nasil calisir"
        let title = Chat.derivedTitle(from: long, limit: 30)
        XCTAssertTrue(title.hasSuffix("…"))
        // Kelime ortasından kesilmemeli.
        XCTAssertFalse(title.dropLast().hasSuffix("bagiml"))
    }

    func testDerivedTitleFlattensNewlines() {
        XCTAssertEqual(Chat.derivedTitle(from: "ilk satir\nikinci"), "ilk satir ikinci")
    }

    func testDerivedTitleHandlesEmpty() {
        XCTAssertEqual(Chat.derivedTitle(from: "   \n  "), "Yeni sohbet")
    }

    // MARK: - Anahtar doğrulama

    func testKeyValidatorStripsQuotesAndEnvPrefix() {
        XCTAssertEqual(KeyValidator.normalize(#"  "AIzaSyAbc123"  "#), "AIzaSyAbc123")
        XCTAssertEqual(KeyValidator.normalize("GEMINI_API_KEY = AIzaSyAbc123"), "AIzaSyAbc123")
        XCTAssertEqual(KeyValidator.normalize("AIza Sy\nAbc123"), "AIzaSyAbc123")
    }

    func testKeyValidatorBlocksObviousMistakes() {
        XCTAssertEqual(KeyValidator.check("", expectedPrefix: "AIza", providerName: "Gemini"),
                       .blocking("Anahtar boş."))
        if case .blocking = KeyValidator.check("https://aistudio.google.com/apikey",
                                              expectedPrefix: "AIza", providerName: "Gemini") {} else {
            XCTFail("URL yapıştırma engellenmeliydi")
        }
        if case .blocking = KeyValidator.check("kisa", expectedPrefix: "AIza", providerName: "Gemini") {} else {
            XCTFail("Çok kısa anahtar engellenmeliydi")
        }
    }

    func testKeyValidatorOnlyWarnsOnPrefixMismatch() {
        // Sağlayıcılar ön eklerini zamanla değiştiriyor; GEÇERLİ bir anahtarı
        // reddetmek, uyarmaktan çok daha kötü bir hata.
        let result = KeyValidator.check("sk-baskaSaglayici123456",
                                        expectedPrefix: "AIza", providerName: "Gemini")
        if case .advisory = result {} else { XCTFail("Yalnızca uyarı olmalıydı") }
    }

    // MARK: - Markdown bölme

    func testMarkdownParsesCodeBlocks() {
        let md = "Giriş\n\n```swift\nlet x = 1\n```\n\nSon"
        let segments = MarkdownSegment.parse(md)
        XCTAssertEqual(segments.count, 3)
        if case .code(let lang, let body) = segments[1] {
            XCTAssertEqual(lang, "swift")
            XCTAssertEqual(body, "let x = 1")
        } else {
            XCTFail("Ortadaki segment kod bloğu olmalıydı")
        }
    }

    func testMarkdownRecoversUnclosedCodeBlock() {
        // Model token sınırında kesilince kapanış ``` hiç gelmez; blok yine de
        // kod olarak gösterilmeli — yarım kod bloğu, hiç blok olmamasından iyi.
        let md = "Şuna bak:\n\n```ts\nconst a = 1"
        let segments = MarkdownSegment.parse(md)
        guard case .code(let lang, let body) = segments.last else {
            return XCTFail("Kapanmamış blok kurtarılmalıydı")
        }
        XCTAssertEqual(lang, "ts")
        XCTAssertEqual(body, "const a = 1")
    }

    // MARK: - İçerik güvenliği (App Store 1.2)

    func testSafetyFilterBlocksHighestRiskPrompts() {
        XCTAssertTrue(ContentSafety.isObviouslyDisallowed("bomba nasıl yapılır"))
        XCTAssertTrue(ContentSafety.isObviouslyDisallowed("HOW TO MAKE A BOMB"))
    }

    func testSafetyFilterDoesNotBlockLegitimateSecurityWork() {
        // Yanlış pozitif, bu üründe zararlı içerikten çok daha sık karşılaşılacak
        // bir hata: meşru güvenlik/geliştirme sorularını engellememeli.
        XCTAssertFalse(ContentSafety.isObviouslyDisallowed("SQL injection açığını nasıl kapatırım"))
        XCTAssertFalse(ContentSafety.isObviouslyDisallowed("bu fonksiyonda bellek sızıntısı var mı"))
        XCTAssertFalse(ContentSafety.isObviouslyDisallowed("XSS nedir"))
    }

    func testReportMailURLIsWellFormedAndTruncatesExcerpt() {
        let url = ContentSafety.reportMailURL(
            reason: .harmful,
            excerpt: String(repeating: "x", count: 2000),
            modelLabel: "Gemini",
            appVersion: "1.0.0 (1)"
        )
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "mailto")
        // Sohbetin tamamı değil, yalnız alıntı gönderilir (veri minimizasyonu).
        XCTAssertTrue((url?.absoluteString.count ?? 0) < 2000)
    }

    // MARK: - Sağlayıcı kataloğu değişmezleri

    func testFreeUpgradesAllHaveKeyURLs() {
        // "Ücretsiz anahtar al" akışındaki her seçenek, anahtarın alınacağı
        // resmî sayfayı göstermek ZORUNDA — yoksa kullanıcı ne yapacağını bilemez.
        for preset in ProviderCatalog.freeUpgrades {
            XCTAssertNotNil(preset.freeKeyURL, "\(preset.displayName) için anahtar adresi yok")
            XCTAssertEqual(preset.freeKeyURL?.scheme, "https")
            XCTAssertNotNil(preset.keyPrefix)
        }
    }

    func testKeylessDefaultNeedsNoKey() {
        XCTAssertNil(ProviderCatalog.keylessDefault.keyPrefix)
        XCTAssertTrue(ModelProfile.keylessDefault.isKeylessDefault)
    }
}
