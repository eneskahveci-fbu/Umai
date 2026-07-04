import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Code2,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
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

/* İki yol — "akıllı ayrım": kullanıcı ilk saniyede kendini seçer. Her yol
   kendi sade deneyimine gider (yaratıcı → stüdyo, kod → uygulama). */
const PATHS = [
  {
    href: "/studio",
    badge: "Yaratıcı işler",
    title: "Tasarla, üret, sor",
    desc: "Bir cümle yaz — web sitesi, sunum, afiş ya da görsel çıksın. Yapay zeka gerisini halleder. Hiçbir şey bilmene gerek yok.",
    icon: <Wand2 size={24} />,
    chips: ["Web sitesi", "Sunum", "Görsel", "Her şeyi sor"],
    cta: "Yaratmaya başla",
  },
  {
    href: "/app",
    badge: "Kod & geliştirme",
    title: "Kod yaz, depona bağlan",
    desc: "Dosyalarını okur, kod üretir, GitHub/GitLab deponu gezer. Sohbet, kod ve terminal tek ekranda — istediğin modelle.",
    icon: <Code2 size={24} />,
    chips: ["Sohbet", "Depo bağla", "Ajan", "Commit"],
    cta: "Kodlamaya başla",
  },
];

/* İnsan diliyle "ne yapabilirsin" — jargon yok, herkes anlar. */
const CAN_DO = [
  { icon: <LayoutTemplate size={20} />, title: "Web sitesi tasarla", desc: "\"Kahve dükkânım için modern bir sayfa\" yaz — dakikada canlı, indirilebilir bir site çıkar." },
  { icon: <FileText size={20} />, title: "Sunum hazırla", desc: "Konuyu söyle, slaytları senin için kursun. PDF ya da bağımsız dosya olarak dışa aktar." },
  { icon: <ImageIcon size={20} />, title: "Görsel üret", desc: "Hayal ettiğini anlat, yapay zeka çizsin. Birden çok varyasyon, anahtar gerekmez." },
  { icon: <MessageCircle size={20} />, title: "Her şeyi sor", desc: "E-posta yaz, bir metni özetle, fikir al, öğren. Sıradan bir sohbet kadar kolay." },
];

const FAQS = [
  {
    q: "Yazılım veya yapay zeka bilmiyorum, kullanabilir miyim?",
    a: "Evet — Craft tam da bunun için tasarlandı. Ne istediğini sıradan cümlelerle yazarsın, gerisini yapay zeka halleder. Hiçbir kurulum, kod ya da teknik bilgi gerekmez.",
  },
  {
    q: "Ücretsiz mi? Kredi kartı istiyor mu?",
    a: "Anında, ücretsiz ve kredi kartsız başlarsın. Hazır gelen ücretsiz yapay zeka ile hemen üretmeye başlayabilirsin. İleri düzey için istersen kendi modelini ekleyebilirsin.",
  },
  {
    q: "Neler yapabilirim?",
    a: "Web sitesi ve sunum tasarlayabilir, görsel üretebilir, metin yazdırabilir, soru sorabilirsin. Yazılımcıysan kod üretip GitHub/GitLab depona bağlanabilirsin — hepsi tek yerde.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Evet. Kendi anahtarını eklersen yalnızca senin tarayıcında kalır, sunucuya gönderilmez. Sohbetlerin için isteğe bağlı bulut senkronu var; kullanmak zorunda değilsin.",
  },
  {
    q: "Telefonda çalışıyor mu?",
    a: "Evet, telefon ve tablette tam çalışır. Ana ekrana uygulama gibi de ekleyebilirsin.",
  },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://craft-coder.vercel.app";

const JSON_LD_APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Craft",
  description:
    "Herkes için yapay zeka stüdyosu. Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp GitHub/GitLab depona bağlan. Kurulum yok, ücretsiz başlar.",
  url: SITE_URL,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  inLanguage: "tr",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Enes Kahveci", email: "eneskahveci.bs@gmail.com" },
  featureList: ["Web sitesi tasarımı", "Sunum üretimi", "Görsel üretimi", "Yapay zeka sohbeti", "Kod & depo entegrasyonu"],
};

const JSON_LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }} />

      {/* NAV */}
      <nav className="sticky top-0 z-50 glass border-b border-line/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight">
            <LogoMark size={28} />
            <span className="text-ink">craft</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/pricing" className="hidden sm:inline-flex text-sm text-muted hover:text-ink font-medium px-3 py-2 transition-colors">
              Fiyatlandırma
            </Link>
            <Link
              href="/app"
              className="flex items-center gap-1.5 bg-brand hover:bg-branddim text-[#111110] font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm shadow-brand/20"
            >
              Başla <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-14 text-center overflow-hidden w-full">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(200,168,126,0.14),transparent)]" />
        <div className="aurora absolute inset-0 -z-10" aria-hidden />

        <span className="animate-rise inline-flex items-center gap-2 text-sm text-muted border border-line bg-surface/70 backdrop-blur-sm px-4 py-1.5 rounded-full mb-8">
          <Sparkles size={13} className="text-brand" />
          kurulum yok · ücretsiz · anında
        </span>

        <h1 className="animate-rise text-[2.6rem] leading-[1.06] sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance" style={{ animationDelay: "60ms" }}>
          Bir cümle yaz,
          <br />
          <span className="brand-text">gerisini yapay zeka halletsin.</span>
        </h1>

        <p className="animate-rise text-lg text-muted max-w-2xl mx-auto mt-6 leading-relaxed text-balance" style={{ animationDelay: "120ms" }}>
          Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp depona bağlan.
          Yazılım da yapay zeka da bilmene gerek yok. Sen anlat, Craft yapsın.
        </p>

        {/* İKİ YOL — akıllı ayrım */}
        <div className="grid sm:grid-cols-2 gap-4 mt-12 text-left animate-rise" style={{ animationDelay: "180ms" }}>
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="hover-lift group relative premium-card rounded-3xl p-6 sm:p-7 flex flex-col overflow-hidden"
            >
              <div className="absolute inset-0 -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(200,168,126,0.08),transparent)]" />
              <div className="relative flex items-center gap-3 mb-4">
                <span className="w-12 h-12 rounded-2xl bg-brand/12 border border-brand/20 grid place-items-center text-brand shrink-0">
                  {p.icon}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand/70">{p.badge}</span>
              </div>
              <h2 className="relative text-2xl font-extrabold tracking-tight mb-2">{p.title}</h2>
              <p className="relative text-sm text-muted leading-relaxed mb-5 flex-1">{p.desc}</p>
              <div className="relative flex flex-wrap gap-1.5 mb-5">
                {p.chips.map((c) => (
                  <span key={c} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-bgsoft border border-line/70 text-muted">{c}</span>
                ))}
              </div>
              <span className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-brand group-hover:gap-2.5 transition-all">
                {p.cta} <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted/60 mt-6">Emin değil misin? İkisini de tek hesapta dener, istediğin zaman geçiş yaparsın.</p>
      </header>

      {/* NE YAPABİLİRSİN — sade, dört öğe */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-14 w-full">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 tracking-tight text-center text-balance">Craft ile neler yapabilirsin?</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {CAN_DO.map((f) => (
            <div key={f.title} className="premium-card rounded-2xl p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
                {f.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] mb-1">{f.title}</h3>
                <p className="text-muted text-[13px] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GÜVEN ŞERİDİ */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-8 w-full">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><Zap size={15} className="text-brand" /> Anında başlar</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-brand" /> Anahtarların sende kalır</span>
          <span className="inline-flex items-center gap-2"><Sparkles size={15} className="text-brand" /> Ücretsiz & kredi kartsız</span>
          <span className="inline-flex items-center gap-2"><MessageCircle size={15} className="text-brand" /> Türkçe, insan diliyle</span>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="relative rounded-[2rem] overflow-hidden border border-brand/20 bg-surface p-10 sm:p-14 text-center elev-2">
          <div className="aurora absolute inset-0 -z-0" aria-hidden />
          <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_60%_90%_at_50%_50%,rgba(200,168,126,0.08),transparent)]" />
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 relative tracking-tight text-balance">Aklındaki şeyi bugün yap</h2>
          <p className="text-muted mb-8 max-w-lg mx-auto relative text-balance">
            Bir cümle yeter. Craft&apos;ı aç, ne istediğini yaz ve sonucu saniyeler içinde gör.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-brand/25 hover:shadow-brand/35 transition-all duration-200 relative text-[15px]"
          >
            Ücretsiz başla <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold mb-3 tracking-tight">Sık sorulan sorular</h2>
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
            <LogoMark size={22} />
            <span className="text-ink">craft</span>
          </div>
          <p className="text-sm text-muted">Herkes için yapay zeka stüdyosu · Tasarla, üret, sor</p>

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
