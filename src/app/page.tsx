import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Code2,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  VenetianMask,
} from "lucide-react";

const FEATURES = [
  {
    icon: <MessageSquare size={20} />,
    title: "Sohbet & Gizli Sohbet",
    desc: "Kaydedilen normal sohbet ya da hiçbir yere yazılmayan gizli sohbet.",
  },
  {
    icon: <Boxes size={20} />,
    title: "Çoklu model",
    desc: "Birden fazla model API'si ekle; üst bardan istediğini seçip onunla çalış.",
  },
  {
    icon: <Code2 size={20} />,
    title: "Coder sekmesi",
    desc: "GitHub deposuna bağlan, dosyaları gez, içeriği sohbete gönderip kod sor.",
  },
  {
    icon: <GitBranch size={20} />,
    title: "Çoklu GitHub hesabı",
    desc: "Birden fazla token ekle, özel depolara eriş, repo'lar arası geçiş yap.",
  },
  {
    icon: <VenetianMask size={20} />,
    title: "Gizlilik",
    desc: "Anahtarların tarayıcında kalır. İstersen Supabase ile cihazlar arası senkron.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Geçmiş senkron",
    desc: "Giriş yaparsan sohbet geçmişin Supabase'de saklanır ve her yerden açılır.",
  },
];

const PROVIDERS = [
  "🤗 Hugging Face",
  "🐋 DeepSeek",
  "🔀 OpenRouter",
  "🦙 Ollama",
  "⚡ vLLM / LM Studio",
  "⚙️ Özel uç",
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur bg-bg/70 border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-xl">
            <span className="w-7 h-7 rounded-lg brand-gradient grid place-items-center text-white text-sm">
              ◆
            </span>
            craft<span className="brand-text">.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/eneskahveci-sdo/craft-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-sm text-muted hover:text-ink"
            >
              GitHub
            </a>
            <Link
              href="/app"
              className="flex items-center gap-1.5 bg-brand hover:bg-branddim text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Uygulamayı Aç <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative max-w-6xl mx-auto px-6 pt-28 pb-20 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(124,92,255,0.12),transparent)]" />
        <span className="inline-flex items-center gap-2 text-sm text-muted border border-line/60 bg-surface/80 backdrop-blur-sm px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" /> model bağımsız · açık kaynak
        </span>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
          Terminalin ve tarayıcın için
          <br />
          <span className="brand-text">AI kod asistanı</span>
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto mt-6 leading-relaxed">
          craft.ai; dosyalarını okur, kod yazar, GitHub deponu gezer — hem de
          istediğin modelle. Hugging Face, DeepSeek, OpenRouter ya da kendi
          yerel modelin: hepsi tek bir akışta.
        </p>
        <div className="flex gap-3 justify-center mt-10 flex-wrap">
          <Link
            href="/app"
            className="flex items-center gap-2 bg-brand hover:bg-branddim text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all duration-200"
          >
            ⚡ Hemen Başla
          </Link>
          <a
            href="https://github.com/eneskahveci-sdo/craft-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-line hover:border-brand/50 px-7 py-3.5 rounded-2xl font-semibold transition-all duration-200"
          >
            ★ GitHub&apos;da Gör
          </a>
        </div>
      </header>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
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
      <section className="max-w-6xl mx-auto px-6 py-12 w-full text-center">
        <h2 className="text-2xl font-extrabold mb-2">İstediğin modelle çalış</h2>
        <p className="text-muted mb-8">OpenAI-uyumlu her uç desteklenir.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {PROVIDERS.map((p) => (
            <span
              key={p}
              className="px-5 py-2.5 rounded-full border border-line bg-surface text-sm font-medium"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* FOOTER + GELİŞTİRİCİ */}
      <footer className="border-t border-line mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2 font-extrabold text-lg mb-3">
            <span className="w-6 h-6 rounded-md brand-gradient grid place-items-center text-white text-xs">
              ◆
            </span>
            craft<span className="brand-text">.ai</span>
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
              className="text-sm text-muted hover:text-brand"
            >
              eneskahveci.bs@gmail.com
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-6 text-xs text-muted/70">
            <Link href="/privacy" className="hover:text-brand">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-brand">Kullanım Şartları</Link>
            <Link href="/cookies" className="hover:text-brand">Çerez Politikası</Link>
            <a href="mailto:eneskahveci.bs@gmail.com" className="hover:text-brand">İletişim</a>
          </div>
          <p className="text-xs text-muted/60 mt-4">© 2026 Enes Kahveci · Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
