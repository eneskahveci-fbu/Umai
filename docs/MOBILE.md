# Craft Coder — Native Uygulama (Capacitor) Rehberi

Site, native kabuğun canlı URL'i yüklediği modelle paketlenir
(`capacitor.config.ts` → `server.url`). Yani uygulama her zaman canlı sürümü
gösterir; mağaza güncellemesi olmadan site güncellemeleri yansır.

## Tek seferlik kurulum (kendi makinende)

```bash
npm install                    # @capacitor/* zaten bağımlılıklarda
npm run cap:add:android        # android/ klasörünü oluşturur
npm run cap:add:ios            # ios/ klasörünü oluşturur (macOS + Xcode)
npm run cap:assets             # resources/*.png'den tüm ikon/splash setlerini üretir
npm run cap:sync               # web ayarlarını platformlara işler
```

- `resources/icon.png`, `resources/splash.png`, `resources/splash-dark.png`
  depoda hazır. Marka görselini değiştirirsen `npm run assets:gen` ile yeniden
  üret (Playwright ile render edilir; `PW_EXECUTABLE_PATH` ile özel Chromium
  yolu verilebilir).

## Çalıştırma / derleme

```bash
npm run cap:android   # Android Studio'da açar → Run / Build APK-AAB
npm run cap:ios       # Xcode'da açar → Run / Archive
```

Farklı bir sunucu adresi test etmek için:
`CAP_SERVER_URL=https://staging.example.com npm run cap:sync`

## Native davranışlar (hazır)

- **Geri tuşu (Android):** `src/lib/native.ts` — geçmiş varsa `history.back()`
  (çok sayfalı rotalar `/app`, `/studio*`, `/settings` ile doğal çalışır;
  /app içi modallar popstate ile önce kapanır), yoksa uygulamadan çıkar.
- **StatusBar:** koyu stil + `#111110` arka plan (initNative).
- **Safe area:** tüm yüzeyler `env(safe-area-inset-*)` kullanır; mobil alt
  gezinme çubuğu klavye açıkken otomatik gizlenir.
- **Paylaş / Haptik:** `nativeShare()` ve `haptic()` (web'de no-op/fallback).

## Mağaza notları

- appId: `ai.craftcoder.app` · appName: `Craft Coder`
- Uzak URL modeli App Store incelemesinde "web wrapper" itirazı alabilir;
  gerekirse `webDir`'e statik export + offline yedek stratejisine geçilebilir
  (mobile/index.html çevrimdışı yedek sayfası mevcut).
