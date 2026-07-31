# GitLab Repo Analizi ve Hata Taraması

**Tarih:** 2026-07-31
**Erişim yöntemi:** Bu depodaki `README.md` içindeki GitLab Personal Access Token ile GitLab API/clone erişimi.
**Analiz edilen proje:** `eneskahveci.bs/craft-coder` (görünen ad: **Umai-studio**, GitLab web arayüzünde `https://gitlab.com/eneskahveci.bs/craft-coder`)

> ⚠️ **Not:** README'deki proje URL'si (`.../umai-studio`) artık geçerli değil — proje GitLab'da `craft-coder` path'i altında duruyor (isim "Umai-studio" olarak değiştirilmiş ama slug değişmemiş/değiştirilmiş). Token, GitLab API üzerinden hesabın tüm projelerine (`craft-coder`, `Sporcu-paneli`, `eneskahveci.bs-project`) erişim sağlıyor.

---

## 0. ACİL: Kimlik Bilgisi Sızıntısı (bu GitHub deposunda)

Bu deponun (`eneskahveci-fbu/Umai`) `README.md` dosyasının **1. satırında düz metin bir GitLab Personal Access Token** commit edilmiş durumda (`glpat-...`). Bu token doğrulandı ve **hâlâ aktif/geçerli** — hesap sahibinin e-postası, tüm projeleri ve GitLab API'sine tam erişim veriyor.

**Önerilen aksiyon (öncelikli):**
1. GitLab → *User Settings → Access Tokens* üzerinden bu token'ı hemen **iptal et (revoke)**.
2. Gerekirse yeni, **kapsamı daraltılmış** (yalnız gerekli proje/izin) ve **kısa ömürlü** bir token üret.
3. Token'ı bir daha asla git'e commit etme — ortam değişkeni / CI secret / secrets manager kullan.
4. Bu depo public ise, token zaten sızmış sayılmalı; git geçmişinden temizlemek (`git filter-repo`/BFG) sorunu çözmez, **iptal etmek** tek gerçek çözümdür.

Bu depoya (Umai) bu konuda kod değişikliği yapılmadı; karar kullanıcıya bırakıldı çünkü README'nin erişim amacıyla bilerek eklenmiş olabileceği değerlendirildi.

---

## 1. Otomatik Kontroller (craft-coder / Umai-studio projesi)

| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` (TypeScript) | ✅ Hata yok |
| `eslint .` | ✅ Hata/uyarı yok |
| `vitest run` | ✅ 105 dosya / 1172 test — hepsi geçti |
| `npm audit` | ⚠️ 9 bulgu (aşağıda) |

Proje **Next.js 16 + React 19 + TypeScript + Supabase + Stripe** tabanlı bir AI kod asistanı / sohbet uygulaması (Capacitor ile mobil, Playwright ile e2e testler dahil). Commit geçmişi, projenin daha önce sistematik bir "bug bash" sürecinden geçtiğini gösteriyor (B1-B5, H3/H5-H7, Ö1-Ö11 etiketli fix/feat commit'leri) — bu da aşağıdaki manuel taramada neden çoğu klasik açığın (path traversal, SSRF, timing attack, admin auth) zaten kapatılmış olduğunu açıklıyor.

## 2. `npm audit` Bulguları

| Paket | Ciddiyet | Özet | Durum |
|---|---|---|---|
| **next** (16.2.6) | **Yüksek** | Birden fazla CVE: App Router/Turbopack middleware bypass, Server Actions'ta DoS, Server Actions üzerinden SSRF, rewrite'larda saldırgan kontrollü hostname ile SSRF, önbellek karışıklığı, **kimlik doğrulamasız internal Server Function endpoint ifşası**, SVG Image Optimization DoS | Düzeltme mevcut: `next@16.2.12`'ye yükselt |
| **postcss** (≤8.5.17) | Yüksek | Source map otomatik yüklemede path traversal (`sourceMappingURL`) → keyfi `.map` dosyası ifşası | Next.js yükseltmesiyle birlikte düzelir |
| **dompurify** (≤3.4.11, `monaco-editor` üzerinden gelen transitive bağımlılık) | Orta | `CUSTOM_ELEMENT_HANDLING`, izinli custom elementler için `afterSanitizeElements`'i atlıyor → XSS bypass riski | `monaco-editor` sürümüne bağlı, izlenmeli |
| **protobufjs** (7.5.0–7.6.4) | Orta | `.proto` seçenek ayrıştırmada sonsuz döngü → DoS | `npm audit fix` ile düzeltilebilir |
| **sharp** (`@huggingface/transformers` → `onnxruntime-node` üzerinden) | Yüksek | libvips'ten miras alınan CVE'ler (CVE-2026-33327/28, 35590/91) | **Düzeltme henüz yok** — üst akış (upstream) bekleniyor |

**Öncelik:** Next.js'i `16.2.12`'ye (veya üzeri) yükseltmek en yüksek etkiyi sağlar; hem doğrudan Next.js CVE'lerini hem de postcss zincirini kapatır. `sharp`/`onnxruntime-node` için şu an düzeltme yok — `@huggingface/transformers`'ın yeni bir sürümünü beklemek veya bu özelliğin gerçekten kullanılıp kullanılmadığını (sunucu tarafında mı, sadece istemcide mi) gözden geçirmek gerekir.

## 3. Manuel Güvenlik/Hata Taraması (bulgular ve gözlemler)

Aşağıdaki alanlar özellikle incelendi; verilen kod zaten sağlam görünüyor, ancak biri **bilinen/kabul edilmiş bir sınırlama** olarak not edildi:

- **Admin uçları** (`/api/admin/users`, `/api/admin/analytics`), **hesap silme** (`/api/account/delete`), **Stripe webhook** (`/api/billing/webhook`): Hepsi service-role anahtarını yalnız sunucuda kullanıyor, kullanıcı token'ını doğruluyor, admin e-posta listesiyle yetki kontrolü yapıyor, webhook imzasını (`stripe.webhooks.constructEvent`) doğruluyor. Sorun bulunmadı.
- **Cron uç noktası** (`/api/cron/cards-reminder`): `CRON_SECRET` ile `timingSafeEqualStr` kullanılarak zamanlama saldırılarına karşı korunmuş.
- **GitHub/GitLab dosya yazma/silme uçları** (`/api/github/write`, `/api/github/delete`, `/api/gitlab/*`): `asOwner`/`asRepo`/`asBranch`/`asRepoPath` ile path traversal (`..`, mutlak yol, kontrol karakterleri) ve enjeksiyon riskine karşı sıkı doğrulama var.
- **SSRF koruması** (`src/lib/urlSafety.ts`, `/api/fetch-text` gibi uçlarda kullanılıyor): IPv4'ün tüm alternatif gösterimlerini (decimal/hex/octal/kısaltılmış) normalize ederek loopback/private/link-local/metadata (169.254.169.254) adreslerini engelliyor; yönlendirmeleri (redirect) tek tek doğruluyor. **Bilinen sınırlama (kodda da belirtilmiş):** DNS rebinding tam olarak engellenmiyor — yani saldırgan, kontrolündeki bir alan adını önce güvenli bir IP'ye, istek anında ise (TOCTOU) dahili bir IP'ye çözümletebilirse bu kontrolü atlatabilir. Tam çözüm için hostname'i tek seferde çözüp elde edilen IP'ye bağlanmak (DNS pinning) gerekir. Şu an için düşük-orta risk olarak değerlendirilebilir; kritik bir iç servise (ör. metadata endpoint) doğrudan erişim ihtimaline karşı iyileştirme önerilir.
- **Yerel Köprü** (`local-bridge/server.js`): Varsayılan olarak yalnızca `127.0.0.1`'i dinliyor, zorunlu token (`crypto.timingSafeEqual` ile karşılaştırılıyor), dosya yollarını `ROOT` dizini dışına çıkmayacak şekilde (`safeResolve`) kısıtlıyor. Bu bir yerel geliştirme aracı olduğu için kabuk komutu çalıştırması beklenen/amaçlanan davranış; token korumasız açık bırakılırsa (`ALLOWED_ORIGIN=*` + token paylaşılırsa) risk oluşur ama bu kullanıcı yapılandırmasına bağlı, kod hatası değil.
- `dangerouslySetInnerHTML` kullanımı yalnızca statik `JSON.stringify` (structured data / JSON-LD) içerikleriyle sınırlı; kullanıcı girdisi enjekte edilmiyor.
- `eval`/`new Function` kullanımı (`src/lib/jsRunner.ts`, `src/lib/preview.ts`) yalnızca kullanıcının **kendi yazdığı** kodu bir sandbox/iframe/worker içinde çalıştırmak için (canlı kod önizleme özelliği) — beklenen tasarım, ama bu tür bir "her zaman JS çalıştırılabilir önizleme" alanının izole edilmiş bir origin/iframe'de çalıştığından emin olunmalı (kapsam dışı hızlı taramada doğrulanamadı, ayrı bir gözden geçirme önerilir).

## 4. Genel Değerlendirme

- Kod tabanı **temiz derleniyor, lint hatası yok, tüm testler geçiyor**.
- Güvenlik açısından hassas uçlar (kimlik doğrulama, ödeme, dosya yazma/silme, SSRF) önceki commit'lerde zaten sistematik olarak sertleştirilmiş.
- Somut, aksiyon alınabilir tek "hata" `npm audit`'teki güncel olmayan bağımlılıklar, özellikle **Next.js 16.2.6 → 16.2.12+ yükseltmesi** (yüksek öncelik).
- En kritik bulgu proje kodunda değil, **bu GitHub deposunun README'sinde açıkta duran GitLab token'ı** — bkz. Bölüm 0.
