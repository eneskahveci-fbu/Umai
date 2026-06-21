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
**Tasarım & Görüntü Stüdyoları**, **canlı kod önizleme (sandbox/Artifacts)**,
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
│   ├── ExtensionsSettings.tsx# Modüler eklenti paketleri (aç/kapat)
│   ├── DesignStudio.tsx      # Claude Design tarzı AI tasarım alanı (sohbet→tuval)
│   ├── ImageStudio.tsx       # Qwen Studio tarzı sohbet akışı (görsel üretim)
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

- **Tasarım Stüdyosu** (`DesignStudio.tsx`): Claude Design benzeri. Sol AI sohbet
  paneli doğal dille tasarım üretir/değiştirir (ücretsiz LLM; `pollinations-free`
  fallback), sağ canlı tuval. Görsel yükleme (vision bağlam), AI slider'lar
  (boşluk/ölçek/renk tonu), kalite seviyeleri. Dışa aktarma: PNG · bağımsız HTML
  · PDF. AI arka plan = Pollinations (anahtarsız).
- **Görüntü Stüdyosu** (`ImageStudio.tsx`): Qwen Studio benzeri sohbet akışı.
  Konuşarak görsel üretir (Pollinations image, keyless), çoklu varyasyon (1/2/4),
  ücretsiz LLM ile prompt geliştirme, model/format seçimi.
- **Sandbox / Artifacts** (`preview.ts` + `ArtifactPanel.tsx`): kod bloğu →
  sandbox'lı iframe canlı önizleme. React/JSX/TSX (Babel standalone CDN),
  HTML+CSS+JS, SVG, mermaid. İframe-içi **console paneli** (parent'a mesaj yok →
  sandbox basit). Panel: önizleme↔kod geçişi, kaynağı kopyala, indir, yenile,
  yeni sekmede aç, büyüt.
- **Öğrenme Modu** (`config.learningMode`): açıkken sistem prompt'una eğitsel
  yönerge eklenir (adım adım açıklama, kavram tanımı, "neden", "Sırada öğren").
  MoreMenu'den toggle; durum çubuğunda rozet. Üniversite öğrencileri için.
- **Kalite Modu** (`config.qualityMode`): tek yanıtta taslak→öz-eleştiri→düzeltme.
- **Oto-ajan**: `autoSwarm(text)` eşik geçince Ajan Ekibi (planlayıcı→paralel
  işçiler→birleştirici, `/api/orchestrate`) butona basmadan devreye girer; repo
  bağlanınca araçlar otomatik açılır. Durum çubuğunda "Oto-ajan" göstergesi.
  Mod enjeksiyonu/tetikleme `CoderView.tsx` içinde (`finalSystemPrompt`).

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
- **Eklentiler:** `ExtensionsSettings.tsx` + `EXTENSION_PACKS` (registry). Araçları
  modüler paketlere gruplar; aç/kapat `config.toolPermissions`'ı toplu ayarlar
  (yeni durum yok). Herkese açık (teknik araç tablosu admin'de kalır).
- **Git bağlama:** Settings → Git'te tek tıkla OAuth (`linkIdentity`;
  `/app?gitlink=...` dönüşünde `provider_token` yakalanıp hesap eklenir)
  **veya** token ile manuel ekleme.
- **Hibrit köprü:** `scripts/terminal-bridge/bridge.mjs` (node-pty + ws) →
  terminal (WS) + `/fs/*` + `/exec` + tokensız `/health`; istemci tarafı
  `src/lib/bridgeFs.ts`.
- **Native sarmalayıcı:** Capacitor (`capacitor.config.ts` canlı siteyi
  `server.url` ile yükler); `src/lib/native.ts` web'de no-op.

## Dağıtım

Canlı site **GitLab** `main`'den (Vercel) dağıtılır; `origin` GitHub'dır ve iki
repo bazı dosyalarda (özellikle `chat/route.ts`) ıraksamıştır. Değişiklikler
GitLab `main`'e cherry-pick ile taşınır — toptan branch push'tan kaçın.

## Kod Konvansiyonları

- Tip ve arayüzleri `import type` ile içe aktar; `any` kullanma.
- Tailwind tasarım token'larını kullan (`bg-surface`, `text-muted`,
  `border-line`, vurgu `amber-400`).
- Global durum için yeni `useState` yerine mevcut Zustand store action'larını
  kullan; `saveConfig` config'i hem state'e hem localStorage'a yazar.
- Yanıtlar ve kullanıcıya dönük metinler Türkçe.
- API anahtarları/token'ları asla koda gömme veya sunucuda saklama.
