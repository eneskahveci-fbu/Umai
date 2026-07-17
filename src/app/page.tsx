import Link from "next/link";
import { ReferralCapture } from "@/components/ReferralCapture";
import {
  ArrowRight,
  ChevronDown,
  Code2,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  LayoutTemplate,
  MessageCircle,
  ShieldCheck,
  Wand2,
} from "lucide-react";

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="28" height="28" rx="7" fill="#5c9478" fillOpacity="0.12" />
      <path
        d="M14 5L22 10.5V17.5L14 23L6 17.5V10.5L14 5Z"
        stroke="#5c9478"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="14" cy="14" r="2.8" fill="#5c9478" fillOpacity="0.85" />
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
    a: "Evet — UMAI tam da bunun için tasarlandı. Ne istediğini sıradan cümlelerle yazarsın, gerisini yapay zeka halleder. Hiçbir kurulum, kod ya da teknik bilgi gerekmez.",
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://umai.vercel.app";

const JSON_LD_APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "UMAI",
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
      <ReferralCapture />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }} />

      {/* NAV */}
      <nav className="sticky top-0 z-50 glass border-b border-line/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight">
            <LogoMark size={28} />
            <span className="text-ink">UMAI</span>
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
      <header className="max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-14 text-center w-full">
        <h1 className="font-serif text-[2.4rem] leading-[1.12] sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance">
          UMAI, konuşarak üreten ve kod yazan yapay zeka platformu.
        </h1>

        <p className="text-lg text-muted max-w-2xl mx-auto mt-6 leading-relaxed text-balance">
          Web sitesi, sunum ve görsel tasarla; kod yaz, GitHub veya GitLab deponu yönet —
          tek platformda, istediğin yapay zeka modeliyle. Kurulum yok, ücretsiz başlar.
        </p>

        {/* İKİ YOL — akıllı ayrım */}
        <div className="grid sm:grid-cols-2 gap-4 mt-12 text-left">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group premium-card rounded-2xl p-6 sm:p-7 flex flex-col transition-colors hover:border-brand/40"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand shrink-0">
                  {p.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{p.badge}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">{p.title}</h2>
              <p className="text-sm text-muted leading-relaxed mb-5 flex-1">{p.desc}</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {p.chips.map((c) => (
                  <span key={c} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-bgsoft border border-line/70 text-ink/80">{c}</span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                {p.cta} <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted/60 mt-6">İkisini de tek hesapta dener, istediğin zaman geçiş yaparsın.</p>
      </header>

      {/* NE YAPABİLİRSİN — sade, dört öğe */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-14 w-full">
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold mb-8 tracking-tight text-center text-balance">UMAI ile neler yapabilirsin?</h2>
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

      {/* ARAŞTIRMA & KURUMLAR */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-3">
            <FlaskConical size={13} /> Araştırma & Kurumlar için
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-balance">Ar-Ge ekipleri, akademisyenler ve kurumlar için</h2>
          <p className="text-muted max-w-2xl mx-auto mt-3 text-balance">Proje başvurusundan sunuma, rapordan postere kadar — araştırma işini konuşarak hazırla. Verini kendi kontrolünde tut.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {[
            { icon: <FileText size={20} />, title: "Başvuru & rapor", desc: "Destek/hibe proje önerisi, dönem ve sonuç raporu iskeletleri; literatür özeti ve kaynakça. Hazır şablonlar Skills panelinde." },
            { icon: <LayoutTemplate size={20} />, title: "Poster & sunum", desc: "Akademik poster, tek sayfalık proje özeti, proje sunumu ve sertifika — Stüdyo'da bir cümleyle üret, PDF olarak dışa aktar." },
            { icon: <ShieldCheck size={20} />, title: "Veri sende kalır", desc: "Anahtarların yalnız tarayıcında; içerik sunucuda saklanmaz. Kendi modelini (yerel/kurum) bağla — gizlilik-önce mimari." },
          ].map((f) => (
            <div key={f.title} className="premium-card rounded-2xl p-5">
              <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-3">{f.icon}</div>
              <h3 className="font-bold text-[15px] mb-1">{f.title}</h3>
              <p className="text-muted text-[13px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
            Araştırma için dene <ArrowRight size={15} />
          </Link>
          <a href="mailto:eneskahveci.bs@gmail.com?subject=UMAI%20—%20Kurumsal%2FAra%C5%9Ft%C4%B1rma%20Kullan%C4%B1m%C4%B1" className="inline-flex items-center gap-2 border border-line bg-surface text-muted hover:text-ink hover:border-brand/40 px-6 py-3 rounded-xl text-sm font-medium transition-colors">
            Kurumsal kullanım / teklif <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="rounded-2xl border border-line bg-surface p-10 sm:p-14 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold mb-3 tracking-tight text-balance">Ücretsiz başla</h2>
          <p className="text-muted mb-8 max-w-lg mx-auto text-balance">
            Hesap oluşturmadan dene; kredi kartı gerekmez.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold px-8 py-4 rounded-xl transition-colors text-[15px]"
          >
            UMAI&apos;yi aç <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 w-full">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl font-semibold mb-3 tracking-tight">Sık sorulan sorular</h2>
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
            <span className="text-ink">UMAI</span>
          </div>
          <p className="text-sm text-muted">Web sitesi, sunum ve görsel tasarla · kod yaz ve depona bağlan</p>

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
