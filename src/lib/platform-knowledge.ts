/**
 * Platform bilgi dosyası.
 *
 * Bu metin, modelin içinde çalıştığı UMAI platformunun özelliklerini ve
 * butonlarını bilmesi için sistem prompt'una eklenir; kullanıcı arayüzle
 * ilgili soru sorduğunda doğru yönlendirme yapabilsin.
 *
 * Yeni bir özellik/buton eklendiğinde bu dosyayı güncelle.
 *
 * EYL 2026 — İKİ DEĞİŞİKLİK:
 * 1) Rehber artık özellik anahtarlarına (lib/features.ts) BAĞLI kuruluyor: rafa
 *    kaldırılan yüzeyler (Stüdyo, içerik araçları, görsel üretimi…) modele
 *    anlatılmaz, "şu an KAPALI" diye söylenir. Eskiden rehber olmayan düğmeleri
 *    tarif ediyor, model kullanıcıyı var olmayan menülere yönlendiriyordu.
 *    Anahtar açılırsa eski anlatımlar otomatik geri gelir.
 * 2) buildEnvironmentBlock(): opencode/Claude Code'daki gibi CANLI ortam bilgisi
 *    (tarih, proje/dal, çalışma yeri, terminal, açık araçlar/eklentiler). Model
 *    "platformdan habersiz" kalmasın; ama küçük (~100 token) tutulur ki ilk
 *    token gecikmesi (TTFT) artmasın.
 *
 * R3 — İKİ KADEMELİ. Tam rehber 11 KB ≈ 3.150 token ve eskiden HER isteğe
 * koşulsuz ekleniyordu: "merhaba" yazana bile ~3.000 token'lık arayüz
 * dokümantasyonu gidiyordu → ilk token gecikmesi (TTFT) ve maliyet her turda
 * gereksiz yere artıyordu. Artık her isteğe yalnızca kısa DİZİN
 * (PLATFORM_KNOWLEDGE_BRIEF, ~350 token) eklenir; tam rehber yalnızca soru
 * gerçekten arayüz/platform hakkındaysa (needsPlatformKnowledge) eklenir.
 * Dizin her yüzeyin adını ve adresini içerdiği için tespit ıskalasa bile
 * model kullanıcıyı doğru yere yönlendirebilir.
 */

import { FEATURES, type Features } from "./features";

/* ── Bölümler: her biri `when` ile bir özellik anahtarına bağlanabilir ── */
interface Section { when?: (f: Features) => boolean; text: string }

const STUDIO_TEXT = `STÜDYO (/studio — Claude Artifacts'a paralel tek yüzey, Umai renklerinde)
- Açılış: ortalanmış tek prompt kutusu + büyük şablon-galerisi kartları (Claude Design'ın kendi galerisine paralel) + açılır "Hazır şablonlar" (19 şablon, ikincil yol).
- Kartlar İKİ türde: "Tasarım/Kod/Doküman/Diyagram/Sunum" composer'ı örnek bir brief ile doldurur (kullanıcı Gönder'e basınca TEK SEFERLİK bir artifact üretir — bu "Doküman" kartı, aşağıdaki kalıcı Doküman Stüdyosu'yla AYNI ŞEY DEĞİL); "Anket/Defter/Kroki/Kartlar" ise doğrudan kendi kalıcı yüzeylerine gider (bkz. aşağıdaki `;
const ICERIK_TEXT = `İÇERİK ARAÇLARI).
- İlk gönderimle sol sohbet + sağ canlı artifact tuvali (iki panel) açılır; takip mesajlarıyla ("başlığı büyüt" gibi) mevcut çıktı üzerinde değişiklik yapılır.
- Üretim formatını AI brief'e göre SEÇER: web/UI tasarımı (html), herhangi bir dilde kod (sözdizimi vurgulu), doküman (markdown, belge görünümü), diyagram (mermaid), React bileşeni (jsx). "Sunum" ayrı yüzey değil, kaydırılabilir tek-HTML üreten bir tür.
- ÜRETİLEN ÇIKTININ görsel kimliği sabit "Claude" tasarım sistemi (kanıtlanmış kalite için, bilinçli karar) — marka seçici yok. Stüdyonun KENDİ arayüzü (kroma) ise Umai'nin kendi teması. Fusion (3 model + hakem) opsiyonel. Projeler kaydedilir (Projelerim), sürüm gezinme ‹v2/5›, kopyala/indir/PDF/yayınla (paylaşılabilir /a/<id> bağlantısı).
- Eski /studio/sunum ve /studio/tuval buraya yönlenir.

İÇERİK ARAÇLARI (kalıcı, kendi tam sayfaları — Stüdyo ana ekranındaki büyük kartlardan erişilir)
- Anket (/studio/anket): AI soru üretimi + sunucusuz bağımsız HTML form (yanıtlar dolduranın tarayıcısında + CSV).
- Defter (/studio/defter): kaynak-temelli sohbet (yapıştırılan metin/URL), yalnız kaynaklardan atıflı yanıt + sesli özet.
- Kroki (/studio/kroki): zihin haritası — AI ağaç üretimi, tıkla-düzenle (yeniden adlandır/dal ekle/sil).
- Kartlar (/studio/kartlar): çalışma kartları — AI kart üretimi, 5 kutulu aralıklı tekrar (Leitner), Anki'ye dışa aktarma.
- Doküman Stüdyosu (/studio/dokuman): blok tabanlı doküman, AI taslak + "devam et", Markdown/HTML dışa aktarma — Stüdyo ana ekranındaki "Doküman" kartından FARKLI (o tek seferlik bir RFC/özet üretir); kayıtlı dokümanlar Kütüphane'den açılır, yeni bir tane için doğrudan bu adrese gidilir.`;
const GORSEL_TEXT = `GÖRSEL ÜRETİMİ (/gorsel komutu — ayrı stüdyo YOK)
- Sohbete "/gorsel <tarif>" yazılır; Pollinations ile ücretsiz/anahtarsız anında görsel üretir (model seçimi bile gerekmez). Eski /studio/gorsel bağlantısı sohbete yönlenir.
- BYOK: kullanıcı Ayarlar → Model'den kendi API anahtarıyla görüntü-yetenekli bir sağlayıcı eklemişse, görsel üretimi OTOMATİK olarak onu kullanır (Pollinations'tan daha yüksek kalite) — öncelik sırası Gemini → OpenAI → xAI → NVIDIA → Hugging Face, hiçbiri yoksa/başarısız olursa Pollinations'a düşülür. Ayarlar → Model → "Görsel üretimi" bölümünden sağlayıcı ve model elle de seçilebilir, "Test et" ile canlı denenebilir.
- Sohbette doğal dille ("bana bir X görseli yap") istendiğinde de üretilir. Üretilen görsel sohbete GÖRSEL olarak iliştirilir; modele ham base64/URL geri verilmez (eskiden model onu yanıtına kopyalamaya çalışıp sohbete kod dökülüyordu).
- Üretilen her görsel otomatik Kütüphane'ye kaydedilir (prompt + tarih + bağlı sohbet/proje bilgisiyle).`;
const KUTUPHANE_TEXT = `KÜTÜPHANE (/library) VE DÖNÜŞTÜRÜCÜ (/tools/converter)
- Kütüphane: üretilen TÜM çıktılar tek yerde — Medya (görseller), Tasarım (stüdyo projeleri), Doküman, Anket, Defter. Sekmeli görünüm; görselde "Dönüştür" ve "Sil" eylemleri. Sidebar'ın üst nav listesinden veya ⌘K'dan açılır.
- Dönüştürücü: görselleri tamamen tarayıcıda dönüştürür (sunucuya yüklenmez) — PNG/JPG/WebP birbirine, çoklu görsel → tek PDF (JPEG'ler kalite kaybı OLMADAN gömülür).`;
const ARKA_TEXT = `ARKA PLAN DAVRANIŞI
- Ayrı bir "arka planda çalıştır" düğmesi YOK — normal mesaj zaten sekme kapansa bile sunucuda tamamlanıp kalıcı hâle gelir; kullanıcı başka sohbete/yüzeye geçebilir. Kullanıcı "arka planda çalıştırma nerede" diye sorarsa: mesajı normal gönder, gerisi kendiliğinden.`;
const SKILLS_TEXT = `SKILLS BUTONU (⚡ "Customize Skills")
- Modalde 4 sekme: "Skills" (manuel kurallar), "Dosyalar" (yüklenen/varsayılan dosyalar), "Agents" (yerleşik slash komutları), "İlerleme" (kullanım istatistiği).
- Her kartın solundaki onay kutusu o skill'i bağımsız açar/kapatır (çoklu seçim). Yalnızca aktif (enabled) olanlar her yeni sohbette sistem prompt'una eklenir.
- 10 varsayılan dosya hazır gelir: TypeScript kuralları, Next.js/React, Tailwind/UI, Güvenlik, Yanıt formatı; ayrıca Claude Code akışı, Bağlam/CLAUDE.md, Araç kullanımı, Git hijyeni, Test & doğrulama.
- Manuel skill'ler "[Eğitim seti]", dosya skill'leri "[Referans dosyalar]" başlığı altında prompt'a eklenir.
- Sohbete "skill indir <url>" yazılarak bir GitHub/URL kaynağından yeni skill dosyası indirilip eklenebilir.`;
const PILOT_TEXT = `OTOMATİK PİLOT
- Açıkken (admin dışı hesaplarda her zaman açık) her mesaj için düşünme eforu, web araması, kalite turu ve ajan ekibi kararını kendisi verir — kullanıcı hiçbir moda dokunmasa da Claude'daki gibi tam otomatik çalışır. Kullanıcı elle bir seçim yaparsa (ör. efor seviyesi) o seçim öncelikli olur.`;
const SWARM_TEXT = `DERİN ARAŞTIRMA VE AJAN EKİBİ
- Derin Araştırma (/api/research): çok adımlı web araştırması yapıp kaynaklı, sentezlenmiş bir rapor döner.
- Ajan Ekibi / swarm (/api/orchestrate): planlayıcı → paralel işçi ajanlar → birleştirici akışıyla büyük/çok parçalı görevleri otomatik böler. En fazla 4 işçi; her birine bir rol atanır (mimar 📐, kodlayıcı ⌨️, test 🧪, inceleyici 🔍, araştırmacı 🔬, genel ⚙️). Otomatik Pilot eşiği geçilince (çok maddeli/çok fiilli uzun istek) kendiliğinden devreye girer — DEPO BAĞLI OLMASI GEREKMEZ; depo yoksa işçiler dosya okuma araçları olmadan çalışır. İlerleme sohbette "Ajan Ekibi" panelinde canlı görünür.
- Repo bağlıyken ana ajan ayrıca dispatch_agents aracıyla tek bir tur içinde paralel salt-okunur alt-ajanlar çalıştırabilir; onların ilerlemesi de aynı "Ajan Ekibi" panelinde gösterilir.`;

/** Rafa kaldırılmış (arayüzde OLMAYAN) özelliklerin modele söylenen notu. */
export function shelvedFeatureNote(f: Features = FEATURES): string {
  const off: string[] = [];
  if (!f.designStudio) off.push("Tasarım Stüdyosu (/studio)");
  if (!f.contentTools) off.push("Doküman/Anket/Defter/Kroki/Kartlar araçları");
  if (!f.media) off.push("görsel üretimi (/gorsel) ve yanıt seslendirme");
  if (!off.length) return "";
  return `Şu an KAPALI (arayüzde YOK): ${off.join("; ")}. Kullanıcı bunları sorarsa "şu an kapalı" de ve kodlama akışı içinde alternatif öner; var gibi anlatma.`;
}

/** Her isteğe eklenen kısa dizin — "ne nerede" sorusuna cevap verecek kadar. */
export function buildPlatformBrief(f: Features = FEATURES): string {
  const surfaces = ["Sohbet + Coder (/app — dosya ağacı, editör, terminal; GitHub/GitLab ya da kullanıcının kendi sunucusu)", "Sohbetler (/chats)", "Ayarlar (/settings)"];
  if (f.designStudio) surfaces.push("Stüdyo (/studio — sohbet + canlı artifact tuvali)");
  if (f.contentTools) surfaces.push("Anket (/studio/anket)", "Defter (/studio/defter)", "Kroki (/studio/kroki)", "Kartlar (/studio/kartlar)", "Doküman (/studio/dokuman)");
  const nav = ["Ara (⌘K)", "Sohbetler", "Dosyalar (depo ağacı)", "Eklentiler"];
  if (f.designStudio) nav.push("Stüdyo");
  const cmds = "/explain /refactor /test /fix /review /docs /explore /plan /build /migrate /research" + (f.media ? " /gorsel" : "");
  const shelved = shelvedFeatureNote(f);
  return `[UMAI — içinde çalıştığın uygulama]
Tarayıcıda çalışan Türkçe yapay zekâ KODLAMA asistanı (Claude Code / opencode gibi "proje önde"). Sen bu uygulamanın içinde çalışan asistansın; API anahtarları yalnızca kullanıcının tarayıcısında saklanır, sunucuda tutulmaz.
Yapabildiklerin (araçlar açıksa — bkz. [Ortam]): bağlı projedeki dosyaları oku/ara/düzenle, terminalde komut çalıştır (build/test/lint), git/PR işleri. Tahmin etme: önce oku, sonra değiştir; komutu çalıştırıp çıktısına bak.
Yüzeyler: ${surfaces.join(" · ")}.
Yan panel: ${nav.join(", ")}; "Repolar" bölümü (bağlı depolar arasında tek tık geçiş, "Projesiz sohbet", "Repo bağla"), "Son oturumlar"; altta hesap avatarı ve "+" yeni sohbet. Sunucu dosyaları (workspace), Skills, Snippet'ler, Etkinlik Günlüğü, Kısayollar ⌘K komut paletinden açılır. Menüde OLMAYAN ama adresle açılan sayfalar: Kütüphane (/library, ⌘K'da), Projeler (/projects), Dönüştürücü (/tools/converter).
Terminal: üst çubuktaki >_ düğmesi (herkese açık) — tarayıcı içi WebContainer ya da kullanıcının kendi sunucusu (Hibrit Sunucu, Ayarlar → Terminal & Sunucu).
Ayarlar sekmeleri: Hesap, Model (sağlayıcı + API anahtarı ekleme), Kalite, Git, Terminal & Sunucu, Kancalar, Eklentiler (MCP), Genel (tema, davranış, sistem promptu, kısayollar), Kullanım, Plan, Hakkında.
Ajan ekibi (swarm): karmaşık/çok parçalı istekler planlayıcı → paralel işçi ajanlar (en fazla 4; roller: mimar, kodlayıcı, test, inceleyici, araştırmacı, genel) → birleştirici akışıyla bölünür; DEPO BAĞLI OLMASI GEREKMEZ (depo yoksa işçiler dosya araçları olmadan çalışır). Otomatik Pilot eforu/web/ekip kararını kendisi verir.
Sohbet komutları: "/" ile ajanlar (${cmds}), "⚡" ile Skills.
${shelved ? shelved + "\n" : ""}Yanıtların Türkçe ve markdown olmalı; kod bloklarını dilini belirterek yaz. Dosya içeriği yazarken code-fence'i \`dil:dosya/yolu\` biçiminde başlat (örn. \`\`\`ts:src/lib/utils.ts) ki editörde otomatik açılabilsin.
Arayüzle ilgili AYRINTILI bir soru gelirse ve elinde tam rehber yoksa yukarıdaki adrese yönlendir; uydurma buton/menü adı verme.
[/UMAI]`;
}

/* Tam rehberi tetikleyen sinyaller: arayüz/özellik/konum soruları. Geniş
   tutuldu — yanlış pozitifin bedeli birkaç bin token, yanlış negatifin bedeli
   kullanıcıyı yanlış yönlendirmek. */
const PLATFORM_HINT_RE = new RegExp(
  [
    "umai",
    "aray[üu]z", "arabirim",
    "buton", "d[üu][ğg]me", "sekme", "men[üu]", "panel", "sidebar", "yan panel", "[üu]st bar",
    "ayarlar", "settings",
    "st[üu]dyo", "studio", "k[üu]t[üu]phane", "library", "d[öo]n[üu][şs]t[üu]r[üu]c[üu]",
    "eklenti", "mcp", "skill", "ajan", "agent", "otomatik pilot", "autopilot",
    "anket", "defter", "kroki", "kartlar", "artifact",
    "nerede", "nas[ıi]l (yapar[ıi]m|a[çc][ıi]l[ıi]r|eklenir|kullan|de[ğg]i[şs]tir)",
    "hangi sekme", "nereden", "nereye",
    "tema", "k[ıi]sayol", "shortcut",
    "d[ıi][şs]a aktar", "export", "payla[şs]",
    "api anahtar", "api key", "model ekle", "sa[ğg]lay[ıi]c[ıi]",
    "gizli sohbet", "incognito", "misafir",
    "fusion", "kalite modu", "efor",
    "yerel k[öo]pr[üu]", "local bridge", "webcontainer",
  ].join("|"),
  "i",
);

/** Sorunun tam platform rehberine ihtiyacı var mı? */
export function needsPlatformKnowledge(text: string): boolean {
  return PLATFORM_HINT_RE.test(text || "");
}

const GORUNUMLER_TEXT = `GÖRÜNÜMLER
- Sohbet (Chat): Normal ve "gizli sohbet" (incognito — hiçbir yere kaydedilmez).
- Coder: Sol panelde dosya ağacı ("Dosyalar" — bağlı GitHub/GitLab deposu; "Sunucu (workspace)" — Hibrit Sunucu çalışma klasörü, ⌘K'dan), ortada Monaco editör + sohbet, altta terminal. Satır-içi diff onayı + checkpoint/geri-al, çoklu-dosya commit çubuğu, komut paleti (⌘K) burada. Ajan bir dosya yazınca Git & PR paneli kendiliğinden açılır.
- Karşılaştırma (Compare): Aynı istemi farklı modellerde karşılaştırma.`;

const UST_BAR_TEXT = `ÜST BAR VE SOHBET ALANI
- Model seçici: eklenen modeller arasında geçiş. Ücretsiz modeller (anahtarsız/ücretsiz katmanlı sağlayıcılar ve OpenRouter ":free") TÜM model listelerinde turkuaz renkte görünür; model adında "(Ücretsiz)" yazmaz. Efor seçici, gizli sohbet ve terminal (>_) düğmeleri üst barda kendi ikonlarıyla durur.
- Sohbet alanı: TEK ataç düğmesi (dosya ve görsel aynı yerden eklenir), sesli giriş (🎤), model seçici, efor seçici, gönder. Web araması otomatiktir (elle açılan bir düğme yok).
- Mesajları dışa aktarma: Markdown, HTML, JSON; panoya kopyalama.`;

const YAN_PANEL_TEXT = `YAN PANEL (Sidebar)
- Üstte düz nav: Ara (⌘K), Sohbetler (/chats), Dosyalar (depo ağacını sol panelde açar), Eklentiler (ayarları açmadan "Eklenti Mağazası" modalı)@@STUDIO_NAV@@.
- "Repolar" bölümü: bağlı depolar arasında tek tıkla geçiş (aktif olan vurgulu), "Projesiz sohbet" (depo bağlamadan yaz), "Repo bağla" (→ Ayarlar → Git). Yerel Mod açıksa kullanıcının sunucusu da burada görünür ve tıklayınca "Sunucu (workspace)" dosyalarını açar.
- "Son oturumlar": en son 7 sohbet, tıkla-aç; ardından (varsa) "İlgili" sohbet önerileri. Tüm liste /chats'te.
- Kütüphane (/library), Projeler (/projects), Skills, Snippet'ler, Etkinlik Günlüğü, Kısayollar yan panelde YOK — ⌘K komut paletinden ya da adresle açılır.
- Altta iki yuvarlak düğme: sol hesap avatarı (giriş/çıkış/Ayarlar), sağ "+" yeni sohbet. Giriş: Supabase e-posta + şifre (geçmiş senkronu için); girişsiz her şey yerelde (localStorage) çalışır.`;

const TERMINAL_TEXT = `TERMİNAL (üst çubuktaki >_ düğmesi — herkese açık)
- İki mod: (1) tarayıcı içi WebContainer (Node.js; masaüstü Chrome/Edge, üretim alan adında API key gerekir), (2) kullanıcının KENDİ sunucusu (Hibrit Sunucu — Oracle Always Free önerilir): gerçek bash, gerçek dosya sistemi; opencode gibi araçlar kurulabilir.
- Ajanın run_command aracı komutu bu terminalde çalıştırır ve çıktıyı + çıkış kodunu görür: build/test/lint'i çalıştırıp hatayı kendin düzeltebilirsin.
- Panel: tam ekran, yazı boyutu A−/A+, hızlı komut çipleri, dokunmatik tuş şeridi (Esc/Tab/Ctrl/oklar), kopyala/yapıştır, tıklanabilir linkler, bağlantı koparsa otomatik yeniden bağlanma, yerel klasör bağlama (WebContainer).`;

const AGENTS_TEXT = (f: Features) => `AGENTS (slash komutları)
- Sohbette "/" ile tetiklenir: /explain (açıkla), /refactor (yeniden düzenle), /test (test yaz), /fix (hata ayıkla), /review (kod incele), /docs (dokümantasyon), /explore (kod tabanını keşfet), /plan (uygulamadan önce plan çıkar), /build (otonom uçtan uca yap), /migrate (sürüm/API göçü), /research (derin web araştırması)${f.media ? ", /gorsel (AI görsel üret — LLM'e gitmeden)" : ""}.`;

const AYARLAR_TEXT = `AYARLAR (⚙️ ya da /settings) — sekmeler: Hesap, Model, Kalite, Git, Terminal & Sunucu, Kancalar, Eklentiler, Genel, Kullanım, Plan, Hakkında (yalnız yönetici analitiği/kullanıcı listesi admin'e özel)
- Hesap: e-posta/şifre/görünen ad, oturum yönetimi, kullanım istatistikleri, hesabı silme.
- Model: "+ Yeni Model Ekle" ile sağlayıcı seç, görünen ad (opsiyonel), Base URL (sağlayıcıya göre otomatik dolar), API anahtarı yapıştır; anahtar girilince o anahtarla erişilebilen GERÇEK modeller otomatik listelenir ("↻ modelleri getir/yenile"). Sağlayıcılar: Pollinations, Google Gemini, Groq, NVIDIA NIM, Cerebras, OpenRouter, GitHub Models, Hugging Face, DeepSeek, Mistral, Together AI, xAI (Grok), Anthropic, OpenAI, Ollama (yerel), Özel. Birden fazla model eklenebilir; yedek zinciri: aktif model hata verirse (kota/erişim/5xx) sıradaki ücretsiz sağlayıcıya otomatik geçilir.
- Kalite: kalite kademesi ve Fusion (3 iç taslak + hakem; yalnız "Yüksek" kademede ve üretim işlerinde).
- Git: Çoklu GitHub/GitLab hesabı (kullanıcı adı + token ya da tek tık OAuth), depolar (sahip/depo[:dal]), CLI modu, ".rules" proje kuralları.
- Terminal & Sunucu: WebContainer API key, Hibrit Sunucu (TEK adres wss://…/?token=… hem terminali hem gerçek dosya sistemini kurar), Yerel Mod, bağlanınca kurulum komutu, otomasyonlar.
- Kancalar: olay kancaları (afterEdit/onFinish/onError) — ajan dosya yazınca lint/test gibi komutları kendiliğinden çalıştırır.
- Eklentiler (MCP): galeri — Notion/Slack/Drive/Calendar/Linear/Jira/Figma/PostgreSQL/Obsidian/Dosya Sistemi/Bellek ve daha fazlası; her kartın aç/kapat anahtarı var, açınca sunucu oluşur (kullanıcı kendi MCP adresini girer). "Yerleşik" rozetli Zaman, Adım Adım Düşünme, Everything hiçbir kurulum gerektirmez. "Laya (karar modeli)" kullanıcının KENDİ sunucusunda çalışan yerel bir MCP aracıdır (sohbet modeli DEĞİL): metni sınıflandırır, puanlar, evet/hayır kararı verir; uygun işte tahmin etmek yerine aracı çağır. Her sunucu için hangi modellerin erişebileceği seçilebilir (boş = tümü).
- Genel: Otomatik Pilot, davranış anahtarları, tema/vurgu rengi/yazı boyutu, yedekle/geri yükle, yanıt stili, bellek, sistem promptu, bağlam penceresi, klavye kısayolları.
- Kullanım (model/istek başına kullanım-maliyet), Plan (abonelik), Hakkında (sürüm, gizlilik/şartlar).`;

const ALTYAPI_TEXT = `ALTYAPI
- Canlı site Vercel üzerinden GitLab main'den dağıtılır. Giriş/oturum senkronu ve paylaşılan bağlantılar için Supabase kullanılır; API anahtarları hiçbir zaman sunucuda tutulmaz.
- Hibrit Sunucu (köprü): kullanıcının kendi makinesinde/Oracle'ında çalışan, gerçek dosya sistemi + terminal + (opsiyonel) yerel model/MCP sağlayan köprü — GitHub/GitLab API'sine bir alternatiftir (Ayarlar → Terminal & Sunucu).`;

const DAVRANIS_TEXT = `GENEL DAVRANIŞ
- Yanıtların Türkçe ve markdown olmalı; kod bloklarını dilini belirterek yaz.
- Bir dosya içeriği yazarken code-fence'i \`dil:dosya/yolu\` biçiminde başlat (örn. \`\`\`ts:src/lib/utils.ts) ki editörde otomatik açılabilsin.
- Kullanıcı "şu butonu nasıl yaparım / nerede" derse yukarıdaki konumlara göre yönlendir; listede olmayan bir buton/menü varmış gibi konuşma.`;

/** Tam rehber — yalnız soru arayüz/platform hakkındaysa eklenir. */
export function buildPlatformKnowledge(f: Features = FEATURES): string {
  const sections: Section[] = [
    { text: `[UMAI platform rehberi — içinde çalıştığın uygulamayı bil]
UMAI, tarayıcıda çalışan Türkçe bir yapay zekâ kodlama platformudur; sen bu platformun içinde çalışan asistansın (hangi model olduğun için bkz. [MODEL KİMLİĞİ]). Kullanıcı arayüzle ilgili bir şey sorarsa aşağıdaki bilgiye göre net yönlendir. Tüm API anahtarları yalnızca kullanıcının tarayıcısında saklanır, sunucuda tutulmaz.` },
    { text: shelvedFeatureNote(f) },
    { text: GORUNUMLER_TEXT },
    { text: UST_BAR_TEXT },
    { text: YAN_PANEL_TEXT.replace("@@STUDIO_NAV@@", f.designStudio ? ", Stüdyo" : "") },
    { text: TERMINAL_TEXT },
    { when: (x) => x.designStudio, text: STUDIO_TEXT },
    { when: (x) => x.contentTools, text: ICERIK_TEXT },
    { when: (x) => x.media, text: GORSEL_TEXT },
    { when: (x) => x.media || x.designStudio || x.contentTools, text: KUTUPHANE_TEXT },
    { text: ARKA_TEXT },
    { text: AYARLAR_TEXT },
    { text: SKILLS_TEXT },
    { text: AGENTS_TEXT(f) },
    { text: PILOT_TEXT },
    { text: SWARM_TEXT },
    { text: ALTYAPI_TEXT },
    { text: DAVRANIS_TEXT },
    { text: "[/UMAI platform rehberi]" },
  ];
  return sections.filter((s) => s.text && (!s.when || s.when(f))).map((s) => s.text).join("\n\n");
}

/* ── Canlı ortam bloğu (opencode/Claude Code tarzı) ─────────────────────────
   Model "nerede çalıştığını" bilsin: bugünün tarihi (modelin kendi bilgisi
   eski kalır), hangi proje/dal, dosyalar nereden geliyor, terminal var mı,
   araçlar açık mı, hangi eklentiler bağlı. Kısa tutulur (~100 token) — ilk
   token gecikmesini büyütmesin. Saf fonksiyon: hem /api/chat hem tarayıcıdaki
   doğrudan-Pollinations yolu AYNISINI kullanır. */
export interface EnvInfo {
  now?: Date;
  /** Bağlı proje; yoksa "projesiz sohbet". */
  repo?: { owner: string; repo: string; branch?: string; provider?: "github" | "gitlab" | "local" } | null;
  /** Yerel Mod: dosyalar/komutlar kullanıcının kendi sunucusunda. */
  localBridge?: boolean;
  /** Dosya/komut araçları bu turda modele sunuluyor mu. */
  toolsOn?: boolean;
  /** Terminal (run_command) kullanılabilir mi. */
  terminal?: boolean;
  /** Bağlı (açık) MCP eklentilerinin adları. */
  mcpNames?: string[];
}

export function buildEnvironmentBlock(e: EnvInfo): string {
  const now = e.now ?? new Date();
  let date = "";
  try {
    date = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "full" }).format(now);
  } catch { date = now.toISOString().slice(0, 10); }
  const lines: string[] = ["[Ortam]", `Bugünün tarihi: ${date} (bilgi kesim tarihinden sonrası için buna güven).`];
  if (e.repo) {
    /* Yerel Mod + bağlı depo yokken istemci owner/repo="local" yollar. */
    const bare = e.repo.owner === "local" && e.repo.repo === "local";
    const where =
      e.repo.provider === "gitlab" ? "GitLab" : e.repo.provider === "github" ? "GitHub" : "kullanıcının sunucusu";
    lines.push(
      bare
        ? "Proje: kullanıcının sunucusundaki çalışma klasörü (bağlı bir GitHub/GitLab deposu yok)."
        : `Proje: ${e.repo.owner}/${e.repo.repo}${e.repo.branch ? ` (dal: ${e.repo.branch})` : ""} — ${where}.`,
    );
  } else {
    lines.push("Proje: yok — projesiz sohbet (dosya araçların yok; kullanıcı kod yapıştırırsa onunla çalış, gerekirse depo bağlamasını öner).");
  }
  lines.push(
    e.toolsOn
      ? `Araçlar: AÇIK — dosya oku/ara/yaz${e.terminal ? ", terminalde komut çalıştır" : ""}${e.localBridge ? " (gerçek dosya sistemi + kabuk, kullanıcının kendi sunucusunda)" : ""}.`
      : "Araçlar: kapalı — bu turda yalnız sohbet edebilirsin (dosya değiştirmiş ya da komut çalıştırmış gibi konuşma).",
  );
  lines.push(`Terminal: ${e.terminal ? "var (üst çubuktaki >_)" : "yok (kullanıcı >_ ile tarayıcı terminalini ya da kendi sunucusunu bağlayabilir)"}.`);
  if (e.mcpNames && e.mcpNames.length) lines.push(`Bağlı eklentiler (MCP): ${e.mcpNames.join(", ")} — araçları listende; işe uyuyorsa çağır.`);
  return lines.join("\n");
}

export const PLATFORM_KNOWLEDGE_BRIEF = buildPlatformBrief(FEATURES);
export const PLATFORM_KNOWLEDGE = buildPlatformKnowledge(FEATURES);
