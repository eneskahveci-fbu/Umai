# Mobil (iOS + Android) — Capacitor ile

craft.coder tek kod tabanından mobil uygulamaya dönüşür. **PWA** (kurulabilir web
uygulaması) ücretsiz ve anında çalışır; **Capacitor** ise App Store / Play Store'a
çıkarmak için native kabuk üretir.

## A) PWA (ücretsiz, anında — mağaza gerekmez)

Zaten hazır: manifest (`src/app/manifest.ts`), service worker (`public/sw.js`,
network-first + çevrimdışı yedek) ve **"Yükle" istemi** (`InstallPrompt`).

- Android/Chrome: tarayıcı "Ana ekrana ekle" sunar; uygulama içi "Yükle" banner'ı da çıkar.
- iOS/Safari: Paylaş → "Ana Ekrana Ekle" (Apple beforeinstallprompt'u desteklemez).

## B) Capacitor (native kabuk → App Store / Play Store)

Native uygulama, yayındaki web uygulamasını yükler (`capacitor.config.ts` →
`server.url`). Böylece **web'deki her güncelleme mobile anında yansır**; ayrı build
gerekmez. Çevrimdışıyken `mobile/index.html` yedeği gösterilir.

### Kurulum (tek seferlik, kendi makinende)

```bash
npm install                 # capacitor bağımlılıkları zaten package.json'da
npm run cap:add:ios         # ios/ klasörünü üretir   (macOS + Xcode gerekir)
npm run cap:add:android     # android/ klasörünü üretir (Android Studio gerekir)
npm run cap:sync            # config + eklentileri senkronla
```

> `ios/` ve `android/` klasörleri makinende üretilir; repoya commit etmek zorunda
> değilsin (Xcode/Android Studio projeleridir).

### Çalıştırma / yayınlama

```bash
npm run cap:ios       # Xcode'da aç → Simulator veya cihazda çalıştır → Archive → App Store
npm run cap:android   # Android Studio'da aç → emülatör/cihaz → Build → AAB → Play Console
```

Geliştirme sırasında yerel sunucuya bağlanmak için:

```bash
CAP_SERVER_URL=http://192.168.1.20:3000 npm run cap:sync   # kendi LAN IP'in
```

## Mağaza ücretleri (kod tarafı ücretsiz; bunlar platform ücreti)

| Platform | Ücret | Not |
|---|---|---|
| **Apple Developer** | **$99 / yıl** | App Store yayını için zorunlu |
| **Google Play** | **$25 / tek sefer** | Play Store yayını için zorunlu |

> Bu ücretler Apple/Google'a aittir; craft.coder kod tarafı tamamen ücretsizdir.
> Yalnızca PWA ile (mağazasız) dağıtım istiyorsan hiçbir ücret gerekmez.

## Notlar

- `server.url` uzaktan yükleme kullandığı için uygulama içeriği her zaman günceldir;
  mağaza güncellemesi yalnızca native kabuk değişince (nadiren) gerekir.
- Push bildirimi, biyometrik vb. native özellikler istenirse ilgili Capacitor
  eklentileri eklenebilir (kapsam dışı).
