# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# craft.ai — Proje Rehberi (CLAUDE.md)

> Bu dosya Claude / yapay zekâ asistanları için proje bağlamını özetler.
> Framework özelindeki kritik uyarılar için yukarıdaki `@AGENTS.md`'yi de oku.

## Proje Nedir?

**craft.ai**, tarayıcı üzerinde çalışan Türkçe bir yapay zekâ kodlama
asistanıdır. Çoklu LLM sağlayıcı desteği, GitHub/GitLab entegrasyonu, Monaco
editör, sohbet/coder/karşılaştırma görünümleri, "Skills" (eğitim seti) sistemi,
**Tasarım Stüdyosu (Claude Design'a birebir paralel)**, sohbette AI görsel
üretimi (`/gorsel`), **canlı kod önizleme (sandbox/Artifacts)**,
**Öğrenme Modu** ve **otomatik ajan ekibi (swarm)** sunar. Tüm API anahtarları
yalnızca kullanıcının tarayıcısında saklanır.

## Teknoloji Yığını

- **Framework:** Next.js 16 (App Router) — *standart Next.js'ten farklıdır, bkz. AGENTS.md*
- **UI:** React 19, Tailwind CSS v4, `lucide-react` ikonları
- **Dil:** TypeScript (`strict` mod)
- **Durum yönetimi:** Zustand (`src/lib/store.ts`)
- **Editör:** `@monaco-editor/react`
- **Backend (opsiyonel):** Supabase (auth + sohbet senkronizasyonu)
- **Test:** Vitest

## Dizin Yapısı

```
src/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Açılış / tanıtım sayfası
│   ├── app/page.tsx          # Ana uygulama (sohbet + coder)
│   └── api/
│       ├── chat/route.ts     # LLM proxy + tool-use döngüsü
│       └── github/           # GitHub entegrasyon uçları
├── components/
│   ├── SkillsPanel.tsx       # "Skills" butonunun açtığı modal
│   ├── CoderView.tsx         # Editör + sohbet + terminal görünümü
│   ├── SettingsModal.tsx     # GNOME tarzı dikey sekmeli ayarlar (arama + admin gating)
│   ├── AccountSettings.tsx   # Hesap: şifre/e-posta/ad, oturum, istatistik, silme
│   ├── ExtensionsSettings.tsx# MCP uygulama galerisi + sunucu yönetimi + dahili araç paketleri (aç/kapat)
│   ├── DesignStudio.tsx      # Claude Design'a birebir paralel (arayüz+çıktı): tek tasarım tuvali + hazır şablonlar
│   ├── ArtifactPanel.tsx     # Canlı önizleme/Artifacts (preview↔kod, kopya, indir)
│   └── ...
├── api/account/delete/route.ts # Hesap silme (servis anahtarı sunucuda; yoksa 501)
└── lib/
    ├── store.ts              # Zustand store (config, skills, chats...)
    ├── types.ts              # Tüm TypeScript arayüzleri
    ├── constants.ts          # PRESETS, DEFAULT_CONFIG, DEFAULT_SKILLS...
    ├── agents.ts             # Slash komut agent'ları (/refactor, /test...)
    ├── fallback.ts           # buildFallbackChain — çok-sağlayıcılı oto-fallback
    ├── preview.ts            # Kod → canlı sandbox (React/JSX/HTML/SVG/mermaid + console)
    ├── mcpCatalog.ts          # MCP uygulama galerisi verisi (Notion/Slack/Drive... — URL içermez)
    └── extensions/registry.ts# EXTENSION_TOOLS/AGENTS/CATALOG + EXTENSION_PACKS
```

## Skills Sistemi (önemli)

"Skills", her yeni sohbetin sistem prompt'una otomatik eklenen bağlam
parçalarıdır. Skills butonuna basınca `SkillsPanel` modali açılır.

- **Veri tipi:** `Skill` (`src/lib/types.ts`) — `id, title, content, tags[],
  enabled, source ("manual" | "file"), fileName?, usageCount, createdAt`.
- **Saklama:** `config.skills[]`, `craftai_config` anahtarıyla localStorage'da.
- **Sekmeler:** *Skills* (manuel kurallar), *Dosyalar* (yüklenen/varsayılan
  dosyalar), *Agents* (yerleşik), *İlerleme* (kullanım istatistiği).
- **Çoklu seçim:** Her kartın solundaki onay kutusu (`toggleSkill`) skill'i
  bağımsız açıp kapatır. Sadece `enabled: true` olanlar prompt'a eklenir.
- **Prompt enjeksiyonu** (`src/app/api/chat/route.ts`): manuel skill'ler
  `[Eğitim seti — bu kurallara her zaman uy]`, dosya skill'leri
  `[Referans dosyalar — örnek olarak kullan]` başlığı altında eklenir.
- **Varsayılan dosyalar:** `DEFAULT_SKILLS` (`src/lib/constants.ts`) yeni
  kullanıcılara 5 hazır skill dosyası getirir (TypeScript, Next.js/React,
  Tailwind/UI, Güvenlik, Yanıt formatı). Hepsi varsayılan olarak aktiftir ve
  onay kutusuyla tek tek seçilebilir.

## Stüdyolar, Önizleme ve Modlar

- **Tasarım Stüdyosu** (`DesignStudio.tsx`, rota `/studio`): Claude Design'a
  birebir paralel — hem ARAYÜZ hem ÇIKTI. Sol AI sohbet, sağ TEK canlı tasarım
  tuvali (`ArtifactCanvas`, sohbetteki `ArtifactPanel` ile PAYLAŞILAN bileşen:
  önizleme↔kod, sürüm gezinme, kopyala/indir/PDF/yayınla). Kök sarmalayıcı
  ARTIK `.theme-claude` TAŞIMIYOR (Tem 2026 kullanıcı kararı, `globals.css`'ten
  o CSS bloğu silindi) — arayüz kroması Umai'nin kendi temasını kullanır;
  yalnızca ÜRETİLEN ÇIKTININ (artifact'in kendi gömülü CSS'i, iframe içinde
  ayrı) görsel kimliği hâlâ sabit "claude" tasarım sistemi (kanıtlanmış kalite
  için bilinçli tutuldu — bkz. aşağı). Sol sohbet paneli (`ChatPanel`) ana
  sohbetteki `.user-bubble` ile AYNI görsel dili kullanır (kullanıcı mesajı
  sağda yuvarlak balon, asistan solda düz-metin akışı, composer yüzen/
  gölgeli `elev-2`). Boş durumda hazır şablon ızgarası (`lib/studioTemplates.ts`,
  19 şablon). Marka SEÇİCİSİ YOK — üretim her zaman sabit "claude" tasarım
  sistemini kullanır (`lib/designSystems.ts`'teki `claude` girdisi, otoriter
  marka sözleşmesi olarak `studioGen.ts`'e enjekte edilir) — çıktı kalitesi
  kanıtlanmış bir sistemden gelsin diye. Ayrıca `studioCraft.ts`'teki
  `CATEGORY_CRAFT` (Tem 2026 "görünmez süpervizör" kararı): STUDIO_SKILLS'in
  kategorisine göre (Web/Uygulama/İçerik/Akademik/Bileşen) kategori lideri
  araçlardan (Gamma, Google AI Studio, LibreOffice, en iyi SaaS landing
  sayfaları, Linear/Notion) damıtılmış somut kompozisyon ilkeleri —
  KULLANICIYA HİÇ GÖSTERİLMEDEN yalnız sistem promptuna eklenir. Fusion (3
  model + hakem) opsiyonel toggle. Üretim `lib/studioGen.ts`'in
  `generateArtifact()`'ı (brief + skill + yön + kategori mükemmelliği + Fusion
  → tek HTML artifact, `/api/chat` üzerinden); "sunum" ayrı bir yüzey DEĞİL,
  yalnızca kendi kendine gezinen tek-HTML-sayfa üreten bir şablon kategorisi
  (`STUDIO_SKILLS`'teki `deck`). Kayıtlı projeler `config.studioProjects`'te.
- **Görüntü üretimi** — artık ayrı bir Stüdyo yüzeyi DEĞİL: genel sohbette
  `/gorsel <brief>` slash komutuyla üretilir (`lib/agents.ts`'teki `image-gen`
  girdisi + `CoderView.tsx`'in `send()`'inde özel-durum intercept — LLM'e
  gitmeden Pollinations URL'i doğrudan asistan mesajına `images[]` olarak
  eklenir). Komut paletinden de tetiklenebilir (`craftai:composer-prefill`
  custom event).
- **Pollinations merkezi** (`lib/pollinations.ts`): görsel URL kurucusu, canlı
  model kataloğu, TTS (ses seçimi + tarayıcı yedeği), `speakableText`. Sohbette
  her asistan yanıtında "Seslendir" butonu bunu kullanır.
- **Stüdyo anahtarı** (`studio/StudioSwitcher.tsx`): tek yüzey (Tasarım) kaldığı
  için kendini gizler — render etmez. İçerik araçları (Anket/Defter/Kroki/
  Kartlar) Sidebar'ın "Araçlar" açılır listesinden ÇIKARILDI (o liste ve mobil
  "Araçlar" alt-sekmesi tamamen kaldırıldı — `SidebarTools.tsx`/
  `MobileToolsSheet.tsx` silindi) — artık Stüdyo ana ekranındaki
  (`studio/StudioHomeScreen.tsx`) büyük, Claude Design şablon galerisine
  paralel kart ızgarasından erişiliyor: 5 "prefill" kartı (Tasarım/Kod/
  Doküman/Diyagram/Sunum, composer'ı örnek brief ile doldurur) + 4 "tool"
  kartı (Anket/Defter/Kroki/Kartlar, `useSurfaceNav().go(surface)` ile
  doğrudan kendi kalıcı yüzeyine gider — kaydetme/koşullu mantık/aralıklı
  tekrar gibi özellikler tek-seferlik üretimle karşılanamayacağından ayrı
  tam sayfalarında kalır). Mobil alt sekme 4 öğe (Sohbet/Stüdyo/Kütüphane/
  Ayarlar) — "Araçlar" sekmesi kaldırıldı, Stüdyo sekmesi zaten aynı kart
  ızgarasına götürüyor; "Kütüphane" masaüstü Sidebar'ın nav listesiyle aynı
  `/library` hedefine gider.
- **Sidebar** (`Sidebar.tsx`): genişletilmiş panelde Claude.ai'nin sol menüsüne
  paralel bir yapı — üstte düz simge+metin nav satırları (Ara/Sohbetler/
  Stüdyo/Kütüphane/Projeler/**Eklentiler**/**Araçlar**, kart/pill değil),
  daraltılmış rail'de de Stüdyo/Eklentiler/**Araçlar**/Ayarlar ikon-buton
  dörtlüsü var, ALTTA Claude'un sol-alt hesap avatarı + sağ-alt "New chat"
  düğmesine paralel iki yuvarlak ikon düğme (hesap menüsü `AuthButton` —
  artık tam-genişlik e-posta metni değil, yalnız baş harf/ikon; yeni sohbet —
  artık üstteki "Yeni Sohbet" metin butonu değil, alttaki yuvarlak `+` ikon
  düğmesi), Umai renklerinde. **Eklentiler artık Ayarlar'ı AÇMAZ** (Tem 2026
  kullanıcı kararı) — hem daraltılmış rail hem genişletilmiş nav'daki buton
  `setExtensionStoreOpen(true)` ile `ExtensionStoreModal.tsx`'i açar (Ayarlar →
  Eklentiler ile AYNI `McpGallery.tsx` bileşenini/veriyi paylaşan hafif bir
  modal — Settings'i hiç mount etmez). **Araçlar** (Tem 2026 kullanıcı kararı
  — "sağ üst menüdeki bazı şeyleri sidebara taşı"): `SidebarToolsButton`
  (`AuthButton`'daki AYNI hafif açılır-panel deseni — ref + dışarı tıklama/
  Escape ile kapanır) Kütüphane/Etkinlik Günlüğü/Kısayollar'ı açar — bunlar
  sohbet ekranındaki "⋯" (`MoreMenu`) menüsünün eski "Araçlar" sekmesinden
  BURAYA taşındı (o sekme tamamen kaldırıldı); "Efor" ve composer-bağlı
  "Prompt geliştir" (canlı taslak metnini işlediği için taşınamaz) "⋯"
  menüsünde kaldı, artık yalnız "Çalışma"/"Modlar" 2 sekmesi var. **Sohbetler
  ve Projeler tam listesi Sidebar'da İNLİNE DEĞİL**
  (Tem 2026 kullanıcı kararı) — kendi ayrı sayfalarına taşındı: `/chats`
  (tarih-gruplu liste, arama, satır eylemleri — pin/etiket/paylaş/indir/
  projeye taşı/sil) ve `/projects` (kart ızgarası; bir projeye tıklamak
  `ProjectModal`'ı açar — o zaten kendi "Sohbetler" sekmesiyle Claude Projects
  tarzı çalışıyordu, bkz. task #65). **Ancak Sidebar gövdesinde "Son
  Sohbetler" HER ZAMAN görünür** (kullanıcı kararıyla geri getirildi, Tem
  2026): en son oluşturulan 7 sohbet, accordion DEĞİL sabit bir liste, tıkla-aç
  (silme/pin/etiket yok — o eylemler yalnız `/chats`'te); ardından (varsa)
  "İlgili" gelir. Arama artık TEK kaynak: ⌘K (`CommandPalette.tsx`) başlık VE
  içerik kapsıyor — ayrı bir arama kutusu yok. Gizlilik/Şartlar/Çerezler
  linkleri Sidebar'dan kaldırıldı — TEK kaynak olarak yalnız Ayarlar →
  Hakkında'da (`SettingsModal.tsx`, zaten oradaydı; aynı işleve iki yol
  bırakmamak için Sidebar'ın kendi `DevCredit` alt-bilgisi silindi).
- **Sohbet ekranı** (`EmptyChat.tsx`): boş durumda artık yalnız karşılama
  başlığı + "kaldığın yerden devam" bağlantısı (Tem 2026 kullanıcı kararı) —
  öneri çipleri (Kodumu daha iyi yap/Yeni özellik/Hata çöz/Açıkla) ve
  "Stüdyo'ya geç" bağlantısı kaldırıldı, Claude'un kendi sade boş-sohbet
  ekranına paralel.
- **Doküman Stüdyosu** (`studio/DocsStudio.tsx`, `/studio/dokuman`): Notion'dan
  ilhamla blok tabanlı doküman (`lib/docs.ts`) — AI taslak + "devam et",
  Markdown/bağımsız HTML dışa aktarma, `config.craftDocs`. **Yazım Asistanı**
  (Grammarly'den ilham, `lib/proofread.ts`): araç çubuğundaki SpellCheck
  butonu metin bloklarını AI'ya denetletir; öneriler `validateIssues` ile
  METNE KARŞI doğrulanır (segmentte geçmeyen "find" elenir — halüsinasyon
  koruması), panelde tek tek/toplu uygulanır (`applyIssue` yalnız ilk
  eşleşmeyi değiştirir; metin değişmişse null → öneri düşer).
- **Anket Stüdyosu** (`studio/FormsStudio.tsx`, `/studio/anket`): Google
  Forms'tan ilhamla (`lib/forms.ts`) — AI soru üretimi, canlı önizleme,
  SUNUCUSUZ bağımsız HTML form (yanıtlar dolduranın tarayıcısında + CSV),
  `/api/publish` ile bağlantı, `config.craftForms`. **Merkezî yanıt toplama
  (opsiyonel)**: sahibi girişliyken yayınlanan/indirilen HTML'e toplama
  kancası gömülür → her gönderim CORS'lu anonim `/api/forms/respond` ucuna
  da POST edilir (`published_forms` sahiplik + `form_responses` tabloları;
  okuma RLS ile yalnız sahibe, HTML'e kullanıcı kimliği gömülmez); özet
  `studio/FormResponses.tsx` ("Yanıtlar" butonu), soru bazlı agregasyon
  `lib/formAnalytics.ts` (saf, test edilebilir).
- **Defter** (`studio/NotebookStudio.tsx`, `/studio/defter`): NotebookLM'den
  ilhamla kaynak-temelli sohbet — metin yapıştır / URL getir (`/api/fetch-text`),
  yalnız kaynaklardan [n] atıflı yanıt, Pollinations TTS "sesli özet",
  `config.craftNotebooks`.
- **Kartlar + Vurgular** (`studio/CardsStudio.tsx`, `/studio/kartlar`):
  Anki'den ilhamla çalışma kartları — brief ya da Vurgular → AI kartlar
  (`lib/cards.ts`), 5 kutulu Leitner aralıklı tekrar (`gradeCard`/`dueCards`;
  bilinçli olarak SM-2 değil), çalışma notu her cevapta sessizce kaydedilir,
  Anki'ye TSV dışa aktarma; `config.craftDecks`. **Vurgular** (Readwise'dan
  ilham): sohbet yanıtındaki seçili metin MessageBubble'daki Vurgula
  (Highlighter) butonuyla `config.highlights`'a düşer (mousedown'da yakalanır
  — seçim temizlenmeden), Kartlar → Vurgular sekmesinde okunur/silinir ve
  "seçilenlerden kart üret" ile desteye dönüşür.
- **Kroki** (`studio/MapStudio.tsx`, `/studio/kroki`): zihin haritası —
  brief → AI ağaç (`lib/mindmap.ts`: normalize + derinlik/dal sınırları),
  tıkla-düzenle (yeniden adlandır / dal ekle / AI "Dallandır" / sil).
  Yerleşim TEK kaynaktan (`layoutMap` saf fonksiyonu): uygulama içi React
  SVG'si de dışa aktarılan bağımsız `.svg` de aynı geometriyi kullanır.
  Dışa aktarma: .svg / Markdown taslak / `/api/publish` (type "svg");
  `config.craftMaps`.
- **Şablon paylaşımı** (`lib/templateShare.ts`): doküman/anket JSON olarak
  dışa/içe aktarılır (Canva'nın şablon paylaşımından ilham, sunucusuz). Bu,
  Tasarım Stüdyosu'nun kendi hazır-şablon galerisinden (`studioTemplates.ts`)
  AYRI bir mekanizma — biri kullanıcının kendi içeriğini paylaşması, diğeri
  uygulamanın kürasyonlu başlangıç noktaları.
- **Ortak üretim çekirdeği** (`lib/genChat.ts`): stüdyo motorlarının paylaştığı
  akışlı LLM çağrısı + JSON ayıklama; anahtarsızda Pollinations'a düşer.
- **Sandbox / Artifacts** (`preview.ts` + `ArtifactPanel.tsx`): kod bloğu →
  sandbox'lı iframe canlı önizleme. React/JSX/TSX (Babel standalone CDN),
  HTML+CSS+JS, SVG, mermaid. İframe-içi **console paneli** (parent'a mesaj
  yollamaz). Panel: önizleme↔kod geçişi, kaynağı kopyala, indir, yenile,
  yeni sekmede aç, büyüt. **İşaretle & Değiştir** (AI Studio Annotation Mode
  paraleli, `ArtifactCanvas` + `artifactDoc.ts`'teki `withAnnotationScript`):
  html/svg önizlemesinde toggle → tıklanan öğenin tanımlayıcısı postMessage
  ile parent'a gelir (TEK istisna mesaj yolu; doğrulama parent'ta —
  e.source + veri şekli) ve composer'a taşınır. Script yalnız CANLI iframe'e
  enjekte edilir; yayınlanan `/a/[id]` sayfası temiz `buildArtifactSrcDoc`
  kullanır. Composer'da ayrıca **AI Chips** (girdi boşken 3 küratörlü
  slash-agent çipi — Açıkla/Düzelt/Refactor, `CoderView.tsx` → `CHIP_AGENTS`)
  ve sesli dikte (`VoiceButton.tsx`) var. Görsel üretimi (`/gorsel`) ve Derin
  Araştırma (`/research`) çipleri kaldırıldı (Tem 2026 kullanıcı kararı) —
  eşdeğerleri artık `generate_image`/`deep_research` araçlarıyla doğal
  dilden tetiklenebiliyor (repo bağlıyken, bkz. "Oto-ajan" bölümü); slash
  komutları (`/gorsel`, `/research`) hâlâ SlashMenu'den elle çağrılabilir.
- **Öğrenme Modu** (`config.learningMode`): açıkken sistem prompt'una eğitsel
  yönerge eklenir (adım adım açıklama, kavram tanımı, "neden", "Sırada öğren").
  MoreMenu'den toggle; durum çubuğunda rozet. Üniversite öğrencileri için.
- **Kalite Modu / görünmez süpervizör** (`config.qualityMode`, Tem 2026
  kullanıcı kararı): tek yanıtta taslak→öz-eleştiri→düzeltme; araçsız/tekil
  sohbet turlarında ayrıca 3 iç taslak+hakem (Fusion) tetikler (bkz.
  `CoderView.tsx`'teki `qualityForced`). **Varsayılan olarak açık**
  (`DEFAULT_CONFIG.qualityMode: true`) — kullanıcı hiçbir şeye dokunmadan en
  kaliteli/hatasız yanıtı ister; Ayarlar → Genel → Davranış'tan (herkese açık,
  admin'e özel değil) hız/maliyet için kapatılabilir. Kapsam bilinçli olarak
  yalnız ana sohbet — Stüdyolara henüz genişletilmedi. Otomatik Pilot'un
  (`config.autoPilot`, admin dışı hesaplarda zaten her zaman açık) kendi
  kalite sezgisiyle (`pilot?.quality`) örtüşür ama manuel anahtar her zaman
  önceliklidir.
- **Oto-ajan / Otomatik Pilot** (`src/lib/autoPilot.ts`): Ekip/Araştırma artık
  elle açılan çip DEĞİL (Tem 2026 kullanıcı kararı — mod çipleri tamamen
  kaldırıldı) — `decidePilotAsync()` her mesajda `/api/route-plan`'a hafif bir
  LLM sınıflandırma çağrısı yapıp effort/quality/fusion kararı alır (ağ/format
  hatasında sessizce senkron regex-tabanlı `decidePilot()`'a düşer); web/
  research/swarm sinyalleri hâlâ regex'te (`autoWeb`/`autoResearch`/
  `autoSwarm`) — bunlar artık organik ARAÇ kararları. Repo bağlıyken
  `generate_image`/`deep_research`/`dispatch_agents` `/api/chat`'in kendi
  tool-calling döngüsünde çalışır (`src/lib/tools.ts` + `chat/route.ts`,
  yalnız `body.tools && body.repoCtx` iken görünür). Repo BAĞLI DEĞİLKEN
  `deep_research`/`dispatch_agents` hâlâ yok — bu yüzden `CoderView.tsx`'in
  `send()`'i o durumda hâlâ eski `/api/research`/`/api/orchestrate` SSE
  endpoint'lerine düşer (bilinçli olarak korundu — bu ikisini repo'suz
  sohbete de tool-loop üzerinden açmak ayrı bir kullanıcı onayı gerektiriyor).
  **`generate_image` istisna** (Faz 6, kullanıcı kararıyla dar kapsamlı
  açıldı): `autoPilot.ts`'teki `autoImageGen()` (regex-tabanlı, NOT: JS `\b`
  Türkçe karaktere başlayan kelimelerde çalışmadığından `\p{L}` tabanlı özel
  sınır kullanır) doğal dilden görsel isteği algılarsa, `body.imageGen` bayrağı
  bu TEK aracı repo bağlı olmasa/Tools kapalı olsa da `/api/chat`'in tool-
  loop'una ekler (`GENERATE_IMAGE_TOOL`, `tools.ts`'ten ayrı export) — hem
  Gate 1'i (`!body.tools && !body.webSearch && !body.imageGen`) hem araç
  listesini gevşetir. Anahtarsız Pollinations'ın kendi tarayıcı-doğrudan hızlı
  yoluna (`CoderView.tsx`, `!toolsEnabled && !wantWeb && !wantImageGen` koşulu)
  bu üçüncü bayrak da eklendi — görsel isteği algılanınca o yol da sunucu-
  proxy'ye düşer. Durum çubuğunda "Ekip"/"Araştırma" rozetleri artık o
  mesajın Otomatik Pilot kararını (`lastPilot.swarm`/`.research`) yansıtır,
  manuel toggle değil.

## Geliştirme Komutları

```bash
npm run dev        # geliştirme sunucusu (predev: tree-sitter wasm kopyalar)
npm run build      # üretim derlemesi (prebuild: tree-sitter wasm kopyalar)
npm run lint       # eslint
npm test           # vitest run (tek seferlik)
npm run test:watch # vitest izleme modu
npx vitest run src/lib/__tests__/validate.test.ts   # tek dosya
npx vitest run -t "isim parçası"                     # tek test (başlığa göre)
npm run test:e2e   # Playwright e2e (e2e/*.spec.ts)
npm run cap:sync   # Capacitor iOS/Android senkron
```

Birim testler `src/lib/__tests__/*.test.ts` altında (vitest, `environment:
node`, `@` → `src` alias — bkz. `vitest.config.ts`). E2E `e2e/` altında
Playwright ile.

## Mimari (Büyük Resim)

> Birden çok dosya okumadan anlaşılmayan akışlar.

- **LLM proxy + tool döngüsü** (`src/app/api/chat/route.ts` + `src/lib/tools.ts`
  → `CODER_TOOLS`): Tek uç, çok sağlayıcılı (`Provider` birliği `src/lib/types.ts`:
  hf, deepseek, openrouter, groq, gemini, mistral, cerebras, together, xai,
  anthropic, pollinations…). İstekteki `provider` alanı dosya araçlarının
  **nereye** gideceğini belirler: `"github"` / `"gitlab"` → ilgili Git API
  (`src/app/api/github/*`, `src/lib/gitlab.ts`); `"local"` → hibrit köprü dosya
  sistemi. Araç çağrıları sunucuda döngüyle çözülür.
- **Token/maliyet optimizasyonu** (repo bağlı sohbette sistem promptu ~12-13K
  token olabiliyor, BYOK kullanıcı kendi faturasını ödüyor): `src/lib/
  repoContextCache.ts` — repo dosya ağacı/SOUL.md/package.json/.gitignore
  içeriğini kısa ömürlü (3dk) bellek-içi `Map` ile önbellekler; hem gereksiz
  GitHub/GitLab API tekrarını önler hem de bu metnin ardışık turlarda BAYT-BAYT
  aynı kalmasını garanti eder (rate-limit.ts'teki AYNI desen — kalıcı depo
  yok, kabul edilebilir). Bu STABİLİTE, `chat/route.ts`'in `body.searchContext`'i
  (turdan turа değişen TEK parça) sysPrompt'un geri kalanından AYRI, ikinci bir
  system mesajı olarak en sona eklemesiyle birleşince Anthropic prompt caching'i
  (`src/lib/anthropic.ts`'teki `convertMessages` — yalnız SON system bloğu
  `cache_control` almaz, önündekiler önbellekten okunur) gerçekten isabet eder:
  büyük, turlar arası sabit blok (repo haritası + SOUL.md + araç talimatları +
  PLATFORM_KNOWLEDGE) yalnız ilk turda tam fiyata gider, sonraki turlarda
  Anthropic'in ucuz cache-read fiyatından okunur.
- **Sağlayıcı sabitleri:** `src/lib/constants.ts` → `PRESETS`, `DEFAULT_CONFIG`,
  `DEFAULT_SKILLS`, `PROVIDER_MODELS`. Varsayılan model anahtarsız
  `pollinations-free`.
- **Çok-sağlayıcılı oto-fallback:** `src/lib/fallback.ts` → `buildFallbackChain`.
  Aktif model hata verince (kota/erişim/5xx) istek düşmez, sıradaki ücretsiz
  sağlayıcıya geçer; her zaman anahtarsız Pollinations tabanı eklenir. İstemci
  zinciri kurar, `/api/chat`'e `fallbacks` olarak yollar; sunucu sırayla dener.
  Stüdyolar ve `CoderView` aynı zinciri kullanır.
- **Durum + kalıcılık:** `src/lib/store.ts` (Zustand) tek kaynak. `saveConfig`
  hem state'e hem `localStorage`'a (`craftai_config`) yazar. Giriş yapılınca
  `syncConfig(userId)` Supabase `user_config` ile birleştirir. **Per-user
  izolasyon:** `CONFIG_OWNER_KEY` ile config sahibi takip edilir; farklı
  kullanıcı girişinde yerel config sızmaz (temiz `DEFAULT_CONFIG`'e düşer).
- **Auth + admin:** Supabase (`src/lib/supabase/{client,server,config}.ts`);
  `config.ts` env yoksa sabit fallback'e düşer (login hep çalışır).
  `src/lib/admin.ts` → `isAdminEmail()`; hassas ayarlar (Hibrit Sunucu,
  Terminal, WebContainer API anahtarı) yalnız admin'e görünür. `/app` girişsiz
  açılmaz (auth gate — `src/app/app/page.tsx`).
- **Ayarlar (GNOME tarzı):** `SettingsModal.tsx` sol dikey sekme çubuğu (ikon +
  başlık) + kenar çubuğunda arama + sağda kaydırılabilir içerik. `ALL_TABS`'ta
  `admin: true` sekmeler (Gelişmiş/MCP/Kancalar) **admin dışı kullanıcıdan
  tamamen gizlenir** (`visibleTabs`). Flex zincirinde `min-h-0` şart (kaydırma).
- **Hesap:** `AccountSettings.tsx` → şifre/e-posta/görünen ad (Supabase
  `updateUser`), oturum yönetimi (`signOut({scope:'global'})`), kullanım
  istatistikleri, hesabı silme. Silme `POST /api/account/delete`: servis anahtarı
  (`SUPABASE_SERVICE_ROLE_KEY`, **yalnız sunucu env**) ile; yoksa 501 ile nazikçe
  reddeder. Kullanıcı kendi access token'ıyla doğrulanır → yalnız kendini siler.
- **Eklentiler:** `McpGallery.tsx` — Ayarlar → Eklentiler (`ExtensionsSettings.tsx`)
  VE Sidebar → Eklentiler'in açtığı `ExtensionStoreModal.tsx` arasında
  PAYLAŞILAN tek bileşen (Tem 2026 kullanıcı kararı — "ChatGPT gibi eklenti
  bağlama" + "mağaza Ayarlar'ı açmasın ama aynı MCP'ye bağlı olsun"): iki
  yüzey de `config.mcpServers` üzerinde çalışır, aralarında senkron sorunu
  olmaz. `src/lib/mcpCatalog.ts`'teki `MCP_CATALOG` ~30 girdilik küratörlü bir
  galeri (Notion/Slack/Drive/Calendar/Linear/Jira/Figma/PostgreSQL/Obsidian/
  Dosya Sistemi/Bellek/Web İçeriği/Tarayıcı Otomasyonu/Docker/Kubernetes/
  Sentry/Cloudflare/Redis/Todoist/Trello/Discord/Spotify/Brave Search/
  Airtable/Confluence/Stripe/Everything/Özel sunucu — GitHub/GitLab BİLİNÇLİ
  OLARAK YOK, uygulamanın kendi gerçek OAuth'lu Git entegrasyonuyla
  karışmasın diye). Her kartın kendi **aç/kapat anahtarı** var (`McpServer.
  catalogId` ile eşlenir): açınca eşleşen sunucu yoksa boş URL'li yeni bir
  `config.mcpServers` girdisi oluşturur (aşağıdaki "Bağlı Sunucular"
  listesinde URL alanı artık DÜZENLENEBİLİR — kullanıcı hemen doldurur),
  varsa yalnız `enabled` değişir (URL/kısıtlama korunur); kapatınca sunucuyu
  SİLMEZ. Galeri kartına tıklamak servis-özel gerçek bir OAuth AÇMAZ —
  kullanıcı hâlâ kendi MCP sunucu adresini+kimliğini girer. Katalog verisi
  bilinçli olarak hiçbir varsayılan sunucu URL'si/harici link içermez
  (`mcpCatalog.test.ts`'te test edilen bir değişmez). **Yerleşik (built-in)
  araçlar** (Tem 2026 kullanıcı kararı — "açık kaynak olan ve doğrudan
  varsayılan olarak yükleyebileceğin eklentiler varsa doğrudan ekle"): Zaman,
  Adım Adım Düşünme, Everything (Test) katalog girdilerinin `builtinUrl`
  alanı var (`/api/mcp/builtin/<id>`) — gerçek açık kaynak MCP referans
  sunucularının İŞLEVİ dış bir URL uydurmadan `src/lib/mcpBuiltins.ts`'te
  (saf, test edilebilir) + `src/app/api/mcp/builtin/[server]/tools/[action]/
  route.ts`'te yeniden uygulandı — bu kartlar GERÇEKTEN kurulum gerektirmeden
  çalışır (kart açılınca `McpGallery.tsx` boş URL yerine doğrudan bu URL'i
  kullanır, galeri kartında "Yerleşik" rozeti gösterilir). Zaman + Adım Adım
  Düşünme yeni kullanıcılarda `DEFAULT_CONFIG.mcpServers`'ta varsayılan açık;
  Everything yalnızca bir MCP-plumbing demosu olduğundan toggle'lanabilir
  kalır ama varsayılan kapalı. Göreli `/api/mcp/builtin/*` yolu HER ZAMAN aynı
  dağıtımın kendi route'una işaret eder (dış host'a asla erişemez) — bu
  yüzden `isSafeRemoteUrl`'in localhost/private-IP SSRF engelinden muaf
  tutulur (`chat/route.ts`'teki `isSafeMcpServerUrl()` + `api/mcp/route.ts`,
  muafiyet yalnızca URL GERÇEKTEN isteğin kendi origin'iyle eşleşiyorsa
  uygulanır — sahte taklit URL'ler yine reddedilir). **Model bazlı erişim**
  (Tem 2026 kullanıcı kararı — "obsidian açıkken tüm modeller ona bağlı
  olsun ama opsiyonel seçimli olsun"): her bağlı sunucunun `allowedModelIds?:
  string[]` alanı var — boş/undefined = TÜM modeller (varsayılan, önceki
  davranışla aynı), doluysa yalnız seçilen model profilleri (`config.models`)
  o sunucunun araçlarını görür. Filtre `src/lib/mcpScope.ts`'teki saf
  `filterMcpServersForModel()` ile uygulanır, `CoderView.tsx`'in `/api/chat`
  isteğine `mcpServers` eklerken aktif modele göre çağrılır (istemci taraflı,
  sunucu tarafında ek değişiklik gerekmez). "Dahili Araç Paketleri"
  (`ExtensionsSettings.tsx`'te ayrı bölüm, `EXTENSION_PACKS`/registry) —
  orijinal, değişmeyen modüler yetenek paketi aç/kapat mantığı. Sidebar'ın
  genişletilmiş nav listesine + daraltılmış rail'ine `Blocks` ikonlu bir
  "Eklentiler" girişi eklendi — `store.extensionStoreOpen` ile modalı açar
  (route DEĞİL, `src/app/app/page.tsx`'te `SkillsPanel` ile aynı lazy-mount
  deseniyle).
- **Git bağlama:** Settings → Git'te tek tıkla OAuth (`linkIdentity`;
  `/app?gitlink=...` dönüşünde `provider_token` yakalanıp hesap eklenir)
  **veya** token ile manuel ekleme.
- **Hibrit köprü:** `scripts/terminal-bridge/bridge.mjs` (node-pty + ws) →
  terminal (WS) + `/fs/*` + `/exec` + tokensız `/health`; istemci tarafı
  `src/lib/bridgeFs.ts`. **Yerel LLM** (`/llm/v1/chat/completions` +
  `/llm/v1/models`, Tem 2026): aynı köprünün, aynı sunucudaki bir Ollama'ya
  OpenAI-uyumlu proxy'si — Ollama yalnız `127.0.0.1:11434`'te dinler, dışarıya
  hiç açılmaz, tek erişim yolu köprünün mevcut token doğrulaması. Uygulama
  tarafında özel bir kod/kavram YOK — kullanıcı bunu normal bir "Özel"
  sağlayıcı gibi ekler (`baseUrl: https://<alan>/llm/v1`, anahtar: köprü
  token'ı) ve `/api/chat` üzerinden AYNI genel OpenAI-uyumlu yoldan geçer.
  Tek-komut kurulum: `deploy/oracle/setup-llm.sh` (Ollama kurar, sunucu
  RAM'ine göre Qwen2.5 14B/7B seçer, köprüyü günceller) — `deploy/oracle/
  setup.sh` (asıl köprü kurulumu) TAMAMLANDIKTAN SONRA, ona ek olarak
  çalışır. Amaç: Pollinations'tan çok daha güçlü bir model, tamamen
  kullanıcının kendi (Oracle Always Free) sunucusunda, üçüncü tarafa veri
  gitmeden.
- **Native sarmalayıcı:** Capacitor (`capacitor.config.ts` canlı siteyi
  `server.url` ile yükler); `src/lib/native.ts` web'de no-op.

## Dağıtım

Canlı site **GitLab** `main`'den (Vercel) dağıtılır; `origin` GitHub'dır ve iki
repo bazı dosyalarda (özellikle `chat/route.ts`) ıraksamıştır. Değişiklikler
GitLab `main`'e cherry-pick ile taşınır — toptan branch push'tan kaçın.

## Kod Konvansiyonları

- Tip ve arayüzleri `import type` ile içe aktar; `any` kullanma.
- Tailwind tasarım token'larını kullan (`bg-surface`, `text-muted`,
  `border-line`, vurgu/dikkat rengi `yellow` — `amber-400` değil).
- Global durum için yeni `useState` yerine mevcut Zustand store action'larını
  kullan; `saveConfig` config'i hem state'e hem localStorage'a yazar.
- Yanıtlar ve kullanıcıya dönük metinler Türkçe.
- API anahtarları/token'ları asla koda gömme veya sunucuda saklama.
