@AGENTS.md

# craft.ai — Proje Rehberi (CLAUDE.md)

> Bu dosya Claude / yapay zekâ asistanları için proje bağlamını özetler.
> Framework özelindeki kritik uyarılar için yukarıdaki `@AGENTS.md`'yi de oku.

## Proje Nedir?

**craft.ai**, tarayıcı üzerinde çalışan Türkçe bir yapay zekâ kodlama
asistanıdır. Çoklu LLM sağlayıcı desteği, GitHub entegrasyonu, Monaco editör,
sohbet/coder/karşılaştırma görünümleri ve "Skills" (eğitim seti) sistemi sunar.
Tüm API anahtarları yalnızca kullanıcının tarayıcısında saklanır.

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
│   └── ...
└── lib/
    ├── store.ts              # Zustand store (config, skills, chats...)
    ├── types.ts              # Tüm TypeScript arayüzleri
    ├── constants.ts          # PRESETS, DEFAULT_CONFIG, DEFAULT_SKILLS...
    └── agents.ts             # Slash komut agent'ları (/refactor, /test...)
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

## Geliştirme Komutları

```bash
npm run dev      # geliştirme sunucusu
npm run build    # üretim derlemesi
npm run lint     # eslint
npm run test     # vitest (tek seferlik)
```

## Kod Konvansiyonları

- Tip ve arayüzleri `import type` ile içe aktar; `any` kullanma.
- Tailwind tasarım token'larını kullan (`bg-surface`, `text-muted`,
  `border-line`, vurgu `amber-400`).
- Global durum için yeni `useState` yerine mevcut Zustand store action'larını
  kullan; `saveConfig` config'i hem state'e hem localStorage'a yazar.
- Yanıtlar ve kullanıcıya dönük metinler Türkçe.
- API anahtarları/token'ları asla koda gömme veya sunucuda saklama.
