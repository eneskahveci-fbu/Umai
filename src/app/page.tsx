import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Code2,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  VenetianMask,
  Zap,
  Brain,
  Globe,
  Terminal,
  ChevronDown,
} from "lucide-react";

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="28" height="28" rx="7" fill="#c8a87e" fillOpacity="0.12" />
      <path
        d="M14 5L22 10.5V17.5L14 23L6 17.5V10.5L14 5Z"
        stroke="#c8a87e"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="14" cy="14" r="2.8" fill="#c8a87e" fillOpacity="0.85" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <MessageSquare size={20} />,
    title: "Sohbet & Gizli Mod",
    desc: "Kaydedilen normal sohbet ya da hiçbir yere yazılmayan gizli sohbet. Gizli modda geçmiş, sunucu veya localStorage'a dokunmaz.",
  },
  {
    icon: <Boxes size={20} />,
    title: "Çoklu Model",
    desc: "Birden fazla model API'si ekle; üst bardan istediğini seçip onunla çalış. Her model ayrı ayarlanabilir.",
  },
  {
    icon: <Code2 size={20} />,
    title: "Coder Sekmesi",
    desc: "GitHub veya GitLab deposuna bağlan, dosyaları gez, içeriği sohbete gönderip kod sor. Diff görünümü ile değişiklikleri karşılaştır.",
  },
  {
    icon: <GitBranch size={20} />,
    title: "GitHub & GitLab Desteği",
    desc: "GitHub ve GitLab token'larını ekle, özel depolara eriş, repo'lar arası geçiş yap. Tek tıkla commit & push.",
  },
  {
    icon: <VenetianMask size={20} />,
    title: "Gizlilik Önce",
    desc: "Anahtarların tarayıcında kalır, sunucuya gönderilmez. İstersen Supabase ile cihazlar arası güvenli senkron.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Geçmiş Senkron",
    desc: "Giriş yaparsan sohbet geçmişin Supabase'de saklanır ve her cihazdan açılır. Offline modda yerel çalışır.",
  },
  {
    icon: <Brain size={20} />,
    title: "Skills & Bellek",
    desc: "Sık kullandığın prompt'ları Skill olarak kaydet. Model her yanıtta bunları bağlam olarak alır.",
  },
  {
    icon: <Zap size={20} />,
    title: "Hızlı Komutlar",
    desc: "⌘K komut paleti, / slash menüsü ve @ mention ile dosyaları ve snippet'ları anında ekle.",
  },
  {
    icon: <Globe size={20} />,
    title: "PWA Desteği",
    desc: "Tarayıcıdan yükle, masaüstü gibi çalıştır. Offline banner, service worker ve hızlı yükleme.",
  },
];

const PROVIDERS = [
  { label: "🤗 Hugging Face", desc: "Ücretsiz inference" },
  { label: "🐋 DeepSeek", desc: "Uygun maliyetli" },
  { label: "🔀 OpenRouter", desc: "100+ model" },
  { label: "🦙 Ollama", desc: "Yerel model" },
  { label: "⚡ Groq", desc: "Ultra hızlı" },
  { label: "🧠 Anthropic", desc: "Claude serisi" },
  { label: "✨ Google Gemini", desc: "Multimodal" },
  { label: "🌟 Mistral", desc: "Açık kaynak" },
  { label: "⚙️ vLLM / LM Studio", desc: "Kendi sunucun" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "API Anahtarını Ekle",
    desc: "Ayarlardan OpenAI-uyumlu herhangi bir sağlayıcının API anahtarını ekle. Anahtar yalnızca tarayıcında saklanır.",
    icon: <Terminal size={22} />,
  },
  {
    step: "2",
    title: "Sohbet Et veya Kod Yaz",
    desc: "Chat sekmesinde soru sor, Coder sekmesinde deposunu aç — dosyaları okuyup kod üret.",
    icon: <MessageSquare size={22} />,
  },
  {
    step: "3",
    title: "Deploy Et",
    desc: "Oluşturulan kodu diff'le karşılaştır, tek tıkla commit at ve canlıya al.",
    icon: <Zap size={22} />,
  },
];

const FAQS = [
  {
    q: "Craft.Coder ücretsiz mi?",
    a: "Evet, tamamen ücretsiz ve açık kaynak. Kendi API anahtarını getir (BYOK) modeliyle çalışır; Craft.Coder herhangi bir model ücreti almaz.",
  },
  {
    q: "Hangi modeller destekleniyor?",
    a: "OpenAI-uyumlu herhangi bir uç desteklenir: Hugging Face, DeepSeek, OpenRouter, Groq, Anthropic, Google Gemini, Mistral, Ollama, vLLM ve daha fazlası.",
  },
  {
    q: "Verilerim nerede saklanıyor?",
    a: "API anahtarların yalnızca tarayıcında (localStorage veya gizli modda sessionStorage) saklanır. Sohbet geçmişi için isteğe bağlı Supabase entegrasyonu var; kullanmak zorunda değilsin.",
  },
  {
    q: "GitHub ve GitLab entegrasyonu nasıl çalışıyor?",
    a: "Coder sekmesinde GitHub veya GitLab personal access token'ınla giriş yaparsın. Repo'ları gezebilir, dosya içeriklerini sohbete gönderebilir, kod değişikliklerini commit edebilirsin. Her iki platform da aynı anda desteklenir.",
  },
  {
    q: "Mobilde çalışıyor mu?",
    a: "Evet. PWA olarak yüklediğinde masaüstü uygulaması gibi çalışır. iOS ve Android'de tam destek var.",
  },
];

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://craft-coder.vercel.app";

const JSON_LD_APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Craft.Coder",
  description:
    "OpenAI-uyumlu herhangi bir modelle çalışan AI kod asistanı. Sohbet, gizli sohbet, geçmiş senkron ve GitHub deposuna bağlı Coder sekmesi.",
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  inLanguage: "tr",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: {
    "@type": "Person",
    name: "Enes Kahveci",
    email: "eneskahveci.bs@gmail.com",
  },
  featureList: [
    "Çoklu model desteği",
    "Coder entegrasyonu",
    "Gizli sohbet modu",
    "PWA desteği",
    "Supabase senkron",
  ],
};

const JSON_LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }}
      />

      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/85 border-b border-line/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight">
            <LogoMark size={28} />
            <span className="text-ink">craft</span><span className="brand-text">.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex items-center gap-1.5 bg-brand hover:bg-branddim text-[#111110] font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm shadow-brand/20"
            >
              Uygulamayı Aç <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center overflow-hidden w-full">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(200,168,126,0.12),transparent)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_35%_25%_at_85%_65%,rgba(200,168,126,0.05),transparent)]" />

        <span className="inline-flex items-center gap-2 text-sm text-muted border border-line bg-surface/70 backdrop-blur-sm px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          model bağımsız · açık kaynak · ücretsiz
        </span>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
          Kod için tasarlanmış
          <br />
          <span className="brand-text">AI asistanın</span>
        </h1>

        <p className="text-lg text-muted max-w-2xl mx-auto mt-6 leading-relaxed">
          Craft.Coder dosyalarını okur, kod yazar, GitHub ve GitLab depolarını gezer — istediğin modelle.
          Hugging Face, DeepSeek, Groq, Anthropic ya da kendi yerel modelin: hepsi tek arayüzde.
        </p>

        <div className="flex gap-3 justify-center mt-10 flex-wrap">
          <Link
            href="/app"
            className="flex items-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold px-8 py-3.5 rounded-2xl shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all duration-200"
          >
            Hemen Başla <ArrowRight size={16} />
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-10 mt-14">
          {[
            { val: "9+", label: "Desteklenen sağlayıcı" },
            { val: "100%", label: "Ücretsiz & açık kaynak" },
            { val: "0", label: "Sunucuya gönderilen anahtar" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold brand-text">{s.val}</div>
              <div className="text-xs text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* NASIL ÇALIŞIR */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold mb-3">Nasıl çalışır?</h2>
          <p className="text-muted max-w-xl mx-auto">Dakikalar içinde kurulum yok, indirme yok — tarayıcıda hemen başla.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="relative rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full brand-gradient grid place-items-center text-[#111110] font-bold text-sm flex-shrink-0">
                  {step.step}
                </span>
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
                  {step.icon}
                </div>
              </div>
              <h3 className="font-bold text-lg mb-2">{step.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 py-8 w-full">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold mb-3">Tüm özellikler</h2>
          <p className="text-muted">Bir AI asistanından beklediğin her şey ve daha fazlası.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-line bg-surface p-6 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4 group-hover:bg-brand/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROVIDERS */}
      <section className="max-w-6xl mx-auto px-6 py-14 w-full text-center">
        <h2 className="text-3xl font-extrabold mb-3">İstediğin modelle çalış</h2>
        <p className="text-muted mb-8 max-w-xl mx-auto">
          OpenAI-uyumlu her uç desteklenir. API anahtarın tarayıcında kalır, biz görmeyiz.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {PROVIDERS.map((p) => (
            <div
              key={p.label}
              className="group flex flex-col items-center px-5 py-3 rounded-2xl border border-line bg-surface hover:border-brand/40 transition-all duration-200"
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span className="text-xs text-muted mt-0.5">{p.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-6xl mx-auto px-6 py-10 w-full">
        <div className="relative rounded-3xl overflow-hidden border border-brand/20 bg-surface p-10 text-center">
          <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(200,168,126,0.07),transparent)]" />
          <h2 className="text-3xl font-extrabold mb-3 relative">
            Hemen dene — kurulum yok
          </h2>
          <p className="text-muted mb-7 max-w-lg mx-auto relative">
            Tarayıcını aç, API anahtarını ekle ve kodlamaya başla. Ücretsiz, açık kaynak, gizliliğe saygılı.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold px-8 py-3.5 rounded-2xl shadow-lg shadow-brand/20 transition-all duration-200 relative"
          >
            Uygulamayı Aç <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14 w-full">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold mb-3">Sık sorulan sorular</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-line bg-surface overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-sm list-none hover:text-brand transition-colors">
                {faq.q}
                <ChevronDown
                  size={16}
                  className="text-muted transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-3"
                />
              </summary>
              <p className="px-6 pb-5 text-sm text-muted leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2 font-extrabold text-lg mb-3">
            <LogoMark size={22} />
            <span className="text-ink">craft</span><span className="brand-text">.ai</span>
          </div>
          <p className="text-sm text-muted">
            Terminal &amp; web tabanlı AI kod asistanı · MIT Lisansı
          </p>

          <div className="mt-8 inline-block rounded-2xl border border-line bg-surface px-8 py-5">
            <div className="text-xs uppercase tracking-widest text-muted mb-1">
              Geliştirici
            </div>
            <div className="text-lg font-bold brand-text">Enes Kahveci</div>
            <a
              href="mailto:eneskahveci.bs@gmail.com"
              className="text-sm text-muted hover:text-brand transition-colors"
            >
              eneskahveci.bs@gmail.com
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-6 text-xs text-muted/70">
            <Link href="/privacy" className="hover:text-brand transition-colors">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-brand transition-colors">Kullanım Şartları</Link>
            <Link href="/cookies" className="hover:text-brand transition-colors">Çerez Politikası</Link>
            <a href="mailto:eneskahveci.bs@gmail.com" className="hover:text-brand transition-colors">İletişim</a>
          </div>
          <p className="text-xs text-muted/60 mt-4">© 2026 Enes Kahveci · Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
