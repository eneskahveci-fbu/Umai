# Cloudflare ile Ölçekleme — craft.coder

Bu doküman, craft.coder'ı (Vercel'de yayında) **Cloudflare** ile ücretsiz katmanda
ölçeklemeyi anlatır: CDN/proxy, cache, WAF ve rate limit. Hepsi Cloudflare **Free**
planında yapılabilir. Kod tarafı zaten hazır (cache header'ları `next.config.ts`'te).

> Mimari not: craft.coder büyük ölçüde **durumsuz** ve **BYOK** (anahtarlar
> tarayıcıda). API uçları dinamik → **önbelleğe alınmaz**; yalnızca statik varlıklar
> uzun cache'lenir.

## 1) DNS / Proxy (turuncu bulut)

1. Cloudflare'e alan adını ekle (Add Site → Free plan).
2. Alan kayıtlarını içe aktar; nameserver'ları Cloudflare'inkilerle değiştir (kayıt
   şirketinde).
3. Vercel'e işaret eden kayıtlar:
   - `CNAME  @  cname.vercel-dns.com`  (veya Vercel'in verdiği hedef)
   - `CNAME  www  cname.vercel-dns.com`
   - **Proxy durumu: turuncu bulut AÇIK** (Cloudflare üzerinden geçsin).
4. Vercel projesinde alan adını **Domains**'e ekle (doğrulama için).
5. SSL/TLS modu: **Full (strict)** (Vercel zaten geçerli sertifika sunar).
6. "Always Use HTTPS" ve "Automatic HTTPS Rewrites": **Açık**. (Kodda HSTS zaten var.)

## 2) Cache kuralları

craft.coder header'ları doğru gönderir; Cloudflare bunlara saygı duyacak şekilde
ayarlanır.

- **Statik varlıklar** (`/_next/static/*`): kod `Cache-Control: public, max-age=31536000,
  immutable` gönderir → Cloudflare uzun süre cache'ler. İçerik-hash'li oldukları için
  güvenli (yeni sürüm = yeni dosya adı).
- **API** (`/api/*`): kod `no-store` gönderir → Cloudflare **cache'lemez** (dinamik,
  BYOK bağlamlı). 
- **HTML / app kabuğu**: kısa cache veya bypass (PWA service worker zaten yönetir).

Cloudflare panelinde (Rules → **Cache Rules**):

| Kural | Eşleşme | Cache durumu | Edge TTL |
|---|---|---|---|
| Statik | `URI Path starts with /_next/static/` | Eligible for cache | 1 yıl (respect origin) |
| API | `URI Path starts with /api/` | **Bypass cache** | — |
| WebSocket/terminal | `URI Path starts with /api` (zaten bypass) | Bypass | — |

> "Respect existing headers" seçilirse origin'in `Cache-Control`'ü kullanılır —
> en güvenlisi budur (kodla tutarlı kalır).

## 3) WAF (Web Application Firewall) — Free

Security → WAF → **Managed Rules**: Cloudflare Free, temel managed ruleset sunar.
Ek olarak **Custom rules** (Free'de birkaç kural hakkı):

- Stripe webhook'unu koru ama engelleme: `/api/billing/webhook` yalnızca `POST`.
- Yönetim/aşırı istek kalıpları için "Managed Challenge" (bot şüphesinde).
- Ülke/AS bazlı kötüye kullanım görürsen blok kuralı ekle (gerekirse).

> Not: API uçlarına **çok agresif** challenge KOYMA — BYOK kullanıcıların tarayıcı
> çağrıları kırılabilir. Yalnızca açık kötüye kullanımı hedefle.

## 4) Rate limiting (Cloudflare) — Free

- Security → **Rate limiting rules**: Free planda 1 kural hakkı vardır.
- Önerilen: `/api/*` için IP başına makul bir sınır (ör. 300 istek / dakika) →
  uygulamadaki bellek-içi rate limit'in (kodda mevcut) önüne ek bir kalkan.
- Aşımda: **Managed Challenge** veya kısa süreli blok.

> Kodda zaten IP-başına bellek-içi rate limit var; Cloudflare katmanı çok-instance
> dağıtımda daha adil ve DDoS'a karşı ilk savunma sağlar.

## 5) Doğrulama

```bash
# Statik varlık uzun cache + Cloudflare HIT mi?
curl -sI https://<alan>/_next/static/chunks/<bir-dosya>.js | grep -iE "cache-control|cf-cache-status"
#   Cache-Control: public, max-age=31536000, immutable
#   cf-cache-status: HIT   (ikinci istekte)

# API asla cache'lenmemeli
curl -sI https://<alan>/api/models -X POST | grep -iE "cache-control|cf-cache-status"
#   Cache-Control: no-store, must-revalidate
#   cf-cache-status: DYNAMIC / BYPASS
```

`npm run build` çıktısı değişmez; bu adım yalnızca header + panel ayarıdır.

## Maliyet

Hepsi **Cloudflare Free** planında. Ücretli hiçbir Cloudflare özelliği gerekmez
(Argo/Workers Paid vb. opsiyoneldir, gerekmiyor).
