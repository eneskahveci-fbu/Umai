# Katkıda Bulunma

Teşekkürler! UMAI'yi daha iyi hale getirmeye yardım etmek için bu rehberi izle.
Türkçe veya İngilizce issue/PR açabilirsin.

## Hızlı başlangıç

```bash
git clone https://github.com/eneskahveci-fbu/Umai.git
cd Umai
npm ci
cp .env.example .env.local   # istersen doldur; boş bırakırsan yerel mod çalışır
npm run dev
```

Gereksinimler: **Node.js 22+** ve npm.

## Testler

PR açmadan önce şunları çalıştır:

```bash
npx tsc --noEmit          # tip kontrolü
npm run lint              # ESLint
npx vitest run            # birim testleri
npm run test:bridge       # köprü/terminal sunucusu testleri
npm run build             # üretim derlemesi
```

Yeni davranış ekliyorsan test de ekle. Hata düzeltmelerinde mümkünse hatayı
yeniden üreten bir test yaz.

## Dal ve commit akışı

- `main` korumalıdır; doğrudan push etme.
- Dal adı: `feat/kisa-aciklama`, `fix/kisa-aciklama`, `docs/...`.
- Commit mesajları: `feat:`, `fix:`, `docs:`, `test:`, `chore:` öneklerinden biri.
- PR açıklamasında **ne değişti** ve **nasıl doğruladın** bölümlerini doldur.
- Küçük, odaklı PR'lar büyük PR'lardan daha hızlı incelenir.

## Kod stili

- TypeScript strict; `any` yerine gerçek tipler kullan.
- React bileşenleri `src/components/`, saf yardımcılar `src/lib/`.
- Kullanıcıya görünen metinler Türkçe ve sade olmalı.
- Yeni bağımlılık eklemeden önce mevcut çözümlerle yapılıp yapılamayacağını kontrol et.

## Güvenlik

- **Hiçbir anahtarı, token'ı veya `.env` dosyasını commit'leme.**
- Gerçek anahtar gereken testlerde düşük entropili sahte değerler kullan.
- Güvenlik açığı bulduysan public issue açma; [SECURITY.md](SECURITY.md) adımlarını izle.

## Lisans

Katkıların MIT lisansı altında yayınlanır. PR göndererek buna onay vermiş olursun.
