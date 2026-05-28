# 🎨 craft.ai — Web

Qwen Studio'dan ilham alan, terminal asistanının web sürümü. Birden fazla LLM modeliyle etkileşim kurabilen, GitHub entegrasyonlu modern web uygulaması.

**Teknoloji Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Vercel

---

## ✨ Özellikler

### 💬 Sohbet Sistemi
- **Normal Sohbet** — Tüm konuşma geçmişi kaydedilir
- **Gizli Sohbet** — Sohbet geçmişi hiçbir yere kaydedilmez (browser tabında kalır)
- **Konuşma Geçmişi** — Daha önceki sohbetleri yükle, düzenle, sil
- **Yerel Mod + Bulut Senkronizasyon** — Supabase kullanmassan yerel depolama, kullanırsan buluta otomatik senkronlanır

### 🧩 Çoklu Model Desteği
- Ayarlardan birden fazla LLM API'si ekle ve yönet:
  - **Hugging Face API**
  - **DeepSeek API**
  - **OpenRouter API**
  - **Özel API Endpoint'leri** (Base URL + Model + Key)
- Sohbet araç çubuğundan hızlıca model değiştir
- Her modelin kendi API anahtarı ve ayarları

### 👨‍💻 Code Editor (Coder Sekmesi)
- **GitHub Entegrasyonu** — Public ve private depolarına bağlan
- **Dosya Ağacı** — Depoyu görselleştir ve dosyaları keşfet
- **İçerik Paylaşımı** — Dosya veya dizin içeriğini direkt sohbete gönder
- **Monaco Editor** — Kod yazı ve düzenleme desteği

### 🔑 Çoklu GitHub Hesabı
- Birden fazla GitHub token ekle ve yönet
- Her token'la farklı public/private depolara erişim
- Token'lar yalnızca browser localStorage'da depolanır (sunucuda saklanmaz)

### 🔐 Güvenlik & Gizlilik
- **API Anahtarları** — Tüm LLM ve GitHub anahtarları sadece tarayıcıda (localStorage)
- **Proxy Sistemi** — LLM çağrıları `/api/chat` sunucu proxy'si üzerinden yapılır:
  - CORS sorunları yok
  - Anahtarlar sunucuya gönderilmez
  - İstemci ve LLM arasında güvenli iletişim
- **Supabase SSR** — Oturum bilgileri güvenli şekilde yönetilir

### ☁️ Opsiyonel Supabase Entegrasyonu
- Proje oluştur, giriş yap → sohbet geçmişin otomatik buluta senkronlanır
- Giriş yapmazsan → yerel localStorage modunda çalışır
- Vercel'de konuşlandırıldığında özellikle faydalı

---

## 📋 Sistem Gereksinimleri

- **Node.js** 18+ veya **Bun** (npm/bun paket yöneticisi)
- **Git** (GitHub entegrasyonu için)
- **Vercel CLI** (opsiyonel, deployment için)

---

## 🚀 Hızlı Başlangıç

### 1. Projeyi Klonla

```bash
git clone https://github.com/eneskahveci-sdo/craft-ai-web.git
cd craft-ai-web
```

### 2. Bağımlılıkları Yükle

```bash
npm install
# veya
bun install
```

### 3. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env.local
```

`.env.local` dosyasını aç ve ihtiyaç duyulan değerleri doldur (sadece Supabase kullanacaksan):

```dotenv
# Supabase (opsiyonel — yoksa uygulama yerel localStorage modunda çalışır)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Sunucu tarafı varsayılan LLM (opsiyonel — kullanıcı arayüzden kendi anahtarını girebilir)
LLM_BASE_URL=https://router.huggingface.co/v1
LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct
LLM_API_KEY=hf_...
```

### 4. Geliştirme Sunucusunu Başlat

```bash
npm run dev
# veya
bun run dev
```

Tarayıcında `http://localhost:3000` açıldığında görmek için bekle.

---

## 🔧 Supabase Kurulumu (Opsiyonel)

Sohbet geçmişini buluta senkronlamak istiyorsan:

### 1. Supabase Projesi Oluştur
- [supabase.com](https://supabase.com) adresine git
- Yeni bir proje oluştur ve seç

### 2. Veritabanı Şemasını Yükle
- Supabase dashboard'unda **SQL Editor**'a git
- `supabase/schema.sql` dosyasındaki tüm SQL'i kopyala ve çalıştır

### 3. API Bilgilerini Kopyala
- **Project Settings** → **API**'ye git
- `URL` ve `anon key` değerlerini kopyala
- `.env.local` dosyasında aşağıdaki değerleri doldur:
  ```dotenv
  NEXT_PUBLIC_SUPABASE_URL=<URL>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
  ```

### 4. Authentication Callback'i Ayarla
- **Authentication** → **URL Configuration**'a git
- **Redirect URLs** bölümüne aşağıdakini ekle:
  ```
  https://<site-domain>/auth/callback
  ```
  - Lokal geliştirme: `http://localhost:3000/auth/callback`
  - Production: `https://your-domain.com/auth/callback`

---

## 📦 Yapı & Dosya Organizasyonu

```
craft-ai-web/
├── src/
│   ├── app/                 # Next.js 16 app router
│   │   ├── layout.tsx       # Ana layout
│   │   ├── page.tsx         # Ana sayfa
│   │   └── api/             # Sunucu API route'ları
│   │       └── chat/        # LLM proxy endpoint
│   ├── components/          # React bileşenleri
│   ├── lib/                 # Yardımcı fonksiyonlar & config
│   ├── hooks/               # React custom hooks
│   ├── store/               # Zustand state yönetimi
│   └── types/               # TypeScript type tanımları
├── supabase/
│   └── schema.sql           # Veritabanı şeması
├── .env.example             # Ortam değişkenleri şablonu
├── tailwind.config.ts       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
├── next.config.ts           # Next.js config
└── package.json             # Node bağımlılıkları
```

---

## 🛠️ Geliştirme & Build

### Mevcut Scriptler

```bash
# Geliştirme sunucusunu başlat (sıcak reload)
npm run dev

# Production build oluştur
npm run build

# Production build'i çalıştır
npm start

# ESLint ile kod stil kontrolü
npm run lint
```

---

## 🌐 Vercel'e Deployment

### 1. Vercel CLI'ı Yükle

```bash
npm i -g vercel
# veya Vercel dashboard üzerinden proje bağla
```

### 2. Giriş Yap

```bash
vercel login
```

### 3. Deploy Et

```bash
# Önizleme ortamına deploy (test için)
vercel

# Production'a deploy (canlı)
vercel --prod
```

### 4. Ortam Değişkenlerini Ayarla
- Vercel dashboard'unda proje ayarlarına git
- **Environment Variables** bölümüne aşağıdakileri ekle:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `LLM_BASE_URL` (opsiyonel)
  - `LLM_MODEL` (opsiyonel)
  - `LLM_API_KEY` (opsiyonel)

---

## 🔌 API Entegrasyon Örnekleri

Uygulamada desteklenen LLM sağlayıcıları:

### Hugging Face
- **Base URL:** `https://router.huggingface.co/v1`
- **Model:** `meta-llama/Llama-3.1-8B-Instruct` (veya tercih ettiğin model)
- **API Key:** [huggingface.co](https://huggingface.co) 'dan al

### DeepSeek
- **Base URL:** `https://api.deepseek.com/v1`
- **Model:** `deepseek-chat`
- **API Key:** [deepseek.com](https://deepseek.com) 'dan al

### OpenRouter
- **Base URL:** `https://openrouter.ai/api/v1`
- **Model:** `meta-llama/llama-3.1-8b-instruct` (veya tercih ettiğin)
- **API Key:** [openrouter.ai](https://openrouter.ai) 'dan al

---

## 📚 Stack Detayları

| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| **Next.js** | 16.2.6 | Modern React framework (App Router) |
| **React** | 19.2.4 | UI component library |
| **TypeScript** | 5 | Statik tip kontrol |
| **Tailwind CSS** | 4 | Utility-first CSS framework |
| **Zustand** | 5.0.13 | Hafif state management |
| **Supabase** | 2.106.2 | Backend as a Service (opsiyonel) |
| **Monaco Editor** | 4.7.0 | Kod editörü (VS Code engine) |
| **Markdown Renderer** | 10.1.0 | Markdown → HTML dönüşümü |

---

## 🤝 Katkıda Bulunma

Bu proje açık kaynak değil, ancak iyileştirme ve hata bildirimi için iletişime geçebilirsin.

---

## 📧 İletişim

**Geliştirici:** Enes Kahveci  
**Email:** eneskahveci.bs@gmail.com  
**GitHub:** [@eneskahveci-sdo](https://github.com/eneskahveci-sdo)

---

## 📝 Lisans

Bu proje kişisel kullanım amaçlıdır. Kullanım şartları için geliştiriciyle iletişime geç.

---

## 🐛 Bilinen Sorunlar & Yol Haritası

- [ ] Daha fazla LLM sağlayıcısı (OpenAI, Anthropic, vb.)
- [ ] Dark mode desteği
- [ ] Konuşma paylaşım ve export özellikleri
- [ ] Offline mode iyileştirmeleri

---

**Son Güncelleme:** 2026 Mayıs
