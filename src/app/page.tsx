import Link from "next/link";
import { ReferralCapture } from "@/components/ReferralCapture";
import { BrandMark } from "@/components/BrandMark";
import { MarketingHeader, OpenAppCta } from "@/components/MarketingHeader";
import {
  ArrowRight,
  ChevronDown,
  GitBranch,
  KeyRound,
  Repeat,
  TerminalSquare,
} from "lucide-react";

/* Dört somut gerçek — "ne yapabilirsin" değil "neden sınırsız". */
const PILLARS = [
  {
    icon: <KeyRound size={18} />,
    title: "Anahtarsız başla",
    desc: "Hesap, kart, API anahtarı yok. Açtığın an hazır ücretsiz modelle yazmaya başlarsın.",
  },
  {
    icon: <Repeat size={18} />,
    title: "Limit dolarsa yedek devreye girer",
    desc: "Bir sağlayıcı kotaya ya da hataya takılınca istek düşmez; sıradaki ücretsiz modele geçer.",
  },
  {
    icon: <GitBranch size={18} />,
    title: "Deponla birlikte çalışır",
    desc: "GitHub ya da GitLab deponu bağla; model dosyaları okur, düzenler, dal ve commit yönetir.",
  },
  {
    icon: <TerminalSquare size={18} />,
    title: "Kendi terminalin",
    desc: "Kendi sunucundaki terminale bağlan, komut çalıştır. Anahtarların yalnız tarayıcında kalır.",
  },
];

/* Otomatik yedek zincirinin gerçek mantığı (lib/fallback.ts) — görsel özet. */
const CHAIN = [
  { name: "Pollinations", note: "anahtarsız", free: true },
  { name: "Groq", note: "ücretsiz katman", free: true },
  { name: "Gemini", note: "ücretsiz katman", free: true },
  { name: "Kendi anahtarın", note: "istersen", free: false },
];

const FAQS = [
  {
    q: "Gerçekten ücretsiz mi? Kredi kartı istiyor mu?",
    a: "Kart istemez. Hazır gelen ücretsiz modellerle hemen yazmaya başlarsın. Daha güçlü bir model istersen kendi API anahtarını eklersin; faturayı sağlayıcın keser, UMAI aracılık payı almaz.",
  },
  {
    q: "Limite takılırsam ne olur?",
    a: "İstek düşmez. Aktif model kota ya da erişim hatası verince sıradaki ücretsiz sağlayıcıya otomatik geçilir; her zaman anahtarsız bir taban modelle devam edersin.",
  },
  {
    q: "Depoma ne kadar erişiyor?",
    a: "Yalnız bağladığın depoya, senin verdiğin izinle. Model dosyaları okur ve düzenler; değişiklikleri sen görür, onaylarsın. Depo bağlamadan da normal sohbet edebilirsin.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Kendi anahtarların yalnızca tarayıcında saklanır, sunucuda tutulmaz. Sohbet senkronu isteğe bağlıdır; kullanmak zorunda değilsin.",
  },
  {
    q: "Telefonda çalışıyor mu?",
    a: "Evet. Telefon ve tablette tam çalışır, ana ekrana uygulama gibi eklenebilir.",
  },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://umai.vercel.app";

const JSON_LD_APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "UMAI",
  description:
    "Asla ödeme yapmadan, asla limitle karşılaşmadan kod yaz ve sohbet et. GitHub/GitLab deponu bağla; kurulum ve kredi kartı yok.",
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  inLanguage: "tr",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Enes Kahveci", email: "eneskahveci.bs@gmail.com" },
  featureList: ["Ücretsiz yapay zeka kodlama asistanı", "Otomatik yedek model zinciri", "GitHub ve GitLab entegrasyonu", "Tarayıcıda terminal"],
};

const JSON_LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <ReferralCapture />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }} />

      {/* NAV — diğer statik sayfalarla (Pricing/Help/Changelog/hukuki) AYNI
         paylaşılan kabuk (bkz. MarketingHeader); önceden bu sayfa tek başına
         farklı bir saydamlık stili (.glass), farklı bir CTA metni ("Başla"
         vs diğerlerinin "Uygulamayı Aç") kullanıyordu. */}
      <MarketingHeader
        maxWidthClass="max-w-6xl"
        right={
          <>
            <Link href="/pricing" className="hidden sm:inline-flex text-sm text-muted hover:text-ink font-medium px-3 py-2 transition-colors">
              Fiyatlandırma
            </Link>
            <OpenAppCta />
          </>
        }
      />

      {/* HERO — tek mesaj: asla ödeme yapmadan, asla limitle karşılaşmadan */}
      <header className="hero-stage relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 pb-10 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-[12px] font-mono text-muted border border-line/70 bg-surface/60 rounded-full pl-2 pr-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />
              Kurulum yok · kart yok · anahtar yok
            </p>
            <h1 className="font-serif text-[2.5rem] leading-[1.08] sm:text-6xl font-semibold tracking-[-0.025em] text-balance">
              Asla ödeme yapmadan, asla limitle karşılaşmadan{" "}
              <span className="text-brand italic">kod yaz</span> ve sohbet et.
            </h1>
            <p className="text-[17px] text-muted max-w-xl mx-auto lg:mx-0 mt-6 leading-relaxed text-balance">
              Depoyu bağla, ne istediğini yaz; model dosyaları okur, düzenler ve komut çalıştırır.
              Ücretsiz modellerle hemen başla, istersen kendi anahtarını getir.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mt-9">
              <Link
                href="/app"
                className="btn-glow inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#0b0d09] font-semibold px-7 py-3.5 rounded-xl text-[15px]"
              >
                Sohbete başla <ArrowRight size={17} />
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink font-medium px-4 py-3.5 transition-colors">
                Fiyatlandırma
              </Link>
            </div>
          </div>

          {/* İMZA — gerçek ürün penceresi: depo rozeti, araç çağrıları, diff, durum çubuğu */}
          <div className="relative" aria-hidden="true">
            <div className="hero-window rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 h-10 border-b border-line/70 bg-surface2/40">
                <span className="flex gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-red/70" />
                  <i className="w-2.5 h-2.5 rounded-full bg-yellow/70" />
                  <i className="w-2.5 h-2.5 rounded-full bg-green/70" />
                </span>
                <span className="mx-auto inline-flex items-center gap-1.5 text-[11px] font-mono text-muted">
                  <GitBranch size={11} className="text-brand/80" /> ornek/proje · main
                </span>
                <span className="w-10" />
              </div>
              <div className="p-4 sm:p-5 font-mono text-[12px] leading-relaxed space-y-3.5">
                <div className="flex gap-2.5">
                  <span className="text-brand select-none">›</span>
                  <p className="text-ink">şifre sıfırlama sayfasındaki boş e-posta hatasını düzelt</p>
                </div>
                <div className="space-y-1 text-muted">
                  <p><span className="text-green">✓</span> src/app/reset-password/page.tsx okundu</p>
                  <p><span className="text-green">✓</span> src/lib/validate.ts okundu</p>
                  <p><span className="text-brand">✎</span> 2 dosya düzenlendi <span className="text-green">+14</span> <span className="text-red">−3</span></p>
                </div>
                <div className="rounded-lg border border-line/70 bg-codebg/70 overflow-hidden text-[11.5px]">
                  <p className="px-3 py-1.5 border-b border-line/60 text-muted/80">src/lib/validate.ts</p>
                  <p className="px-3 py-0.5 bg-red/10 text-red/90">− if (email) return true;</p>
                  <p className="px-3 py-0.5 bg-green/10 text-green">+ if (!email.trim()) return false;</p>
                  <p className="px-3 py-0.5 bg-green/10 text-green">+ return EMAIL_RE.test(email);</p>
                </div>
                <p className="text-ink/90 font-sans text-[13px] leading-relaxed">
                  Boş e-posta artık formu göndermeden engelleniyor. Testi de ekledim.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 h-9 border-t border-line/70 bg-surface2/40 text-[11px] font-mono">
                <span className="text-cyan">Pollinations</span>
                <span className="text-muted">₺0 · limit yok</span>
              </div>
            </div>
            <p className="text-center text-[11px] text-muted/60 mt-3">Örnek oturum</p>
          </div>
        </div>
      </header>

      {/* NEDEN SINIRSIZ — dört somut gerçek */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full">
        <div className="max-w-2xl mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-balance">Sürpriz fatura ve “limit doldu” ekranı yok.</h2>
          <p className="text-muted mt-3 leading-relaxed">Ürün, tek bir sağlayıcının kotasına bağlı kalmayacak şekilde kurulu.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PILLARS.map((f) => (
            <div key={f.title} className="premium-card rounded-2xl p-5 hover:border-brand/30">
              <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand grid place-items-center mb-4">{f.icon}</div>
              <h3 className="font-semibold text-[15px] mb-1.5 tracking-tight">{f.title}</h3>
              <p className="text-muted text-[13px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* YEDEK ZİNCİRİ — otomatik geçişin görsel özeti */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-10 w-full">
        <div className="premium-card rounded-3xl p-6 sm:p-10">
          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-balance">Biri tıkanınca, sıradaki devralır.</h2>
              <p className="text-muted mt-3 leading-relaxed text-[15px]">
                Kota, erişim ya da sunucu hatası olduğunda istek yarıda kalmaz; ücretsiz sağlayıcılar arasında
                otomatik geçilir. Sen aynı sohbette devam edersin.
              </p>
            </div>
            <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2.5">
              {CHAIN.map((c, i) => (
                <li key={c.name} className="flex sm:flex-1 items-center gap-2.5">
                  <div className="flex-1 rounded-xl border border-line/80 bg-bg/60 px-4 py-3.5">
                    <p className={`text-[14px] font-semibold ${c.free ? "text-cyan" : "text-ink"}`}>{c.name}</p>
                    <p className="text-[11px] font-mono text-muted mt-0.5">{c.note}</p>
                  </div>
                  {i < CHAIN.length - 1 && <ArrowRight size={14} className="hidden sm:block text-muted/50 shrink-0" />}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full">
        <div className="cta-panel rounded-3xl px-6 py-14 sm:py-16 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3 tracking-tight text-balance">İlk mesajını şimdi gönder.</h2>
          <p className="text-muted mb-8 max-w-md mx-auto text-balance">Kayıt olmadan dene; kredi kartı gerekmez.</p>
          <Link
            href="/app"
            className="btn-glow inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#0b0d09] font-semibold px-8 py-4 rounded-xl text-[15px]"
          >
            Sohbete başla <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3 tracking-tight">Sık sorulan sorular</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group premium-card rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-[15px] list-none hover:text-brand transition-colors">
                {faq.q}
                <ChevronDown size={16} className="text-muted transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-3" />
              </summary>
              <p className="px-6 pb-5 text-sm text-muted leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line mt-auto">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2 font-extrabold text-lg mb-3">
            <BrandMark size={22} />
            <span className="text-ink">UMAI</span>
          </div>
          <p className="text-sm text-muted">Asla ödeme yapmadan, asla limitle karşılaşmadan kod yaz ve sohbet et.</p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-8 text-xs text-muted/70">
            <Link href="/pricing" className="hover:text-brand transition-colors">Fiyatlandırma</Link>
            <Link href="/privacy" className="hover:text-brand transition-colors">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-brand transition-colors">Kullanım Şartları</Link>
            <Link href="/cookies" className="hover:text-brand transition-colors">Çerez Politikası</Link>
            <a href="mailto:eneskahveci.bs@gmail.com" className="hover:text-brand transition-colors">İletişim</a>
          </div>
          <p className="text-xs text-muted/60 mt-5">© 2026 Enes Kahveci · Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
