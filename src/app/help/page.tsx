import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown, Rocket, Cpu, LayoutGrid, UserRound, ShieldCheck } from "lucide-react";
import { MarketingHeader, OpenAppCta } from "@/components/MarketingHeader";

export const metadata: Metadata = {
  title: "Yardım Merkezi — UMAI",
  description: "UMAI hakkında sık sorulan sorular — başlarken, modeller, stüdyolar, hesap ve gizlilik.",
};

interface Faq { q: string; a: string }
interface Category { title: string; icon: typeof Rocket; faqs: Faq[] }

const CATEGORIES: Category[] = [
  {
    title: "Başlarken",
    icon: Rocket,
    faqs: [
      {
        q: "UMAI nedir?",
        a: "UMAI, tarayıcı üzerinde çalışan Türkçe bir yapay zekâ kodlama ve üretkenlik asistanıdır. Sohbet, kod editörü, tasarım/doküman/anket/defter gibi stüdyo yüzeyleri ve çoklu LLM sağlayıcı desteği sunar.",
      },
      {
        q: "Kullanmak için API anahtarı gerekli mi?",
        a: "Hayır. Anahtarsız, ücretsiz Pollinations tabanı varsayılan olarak açıktır — hiçbir şey ayarlamadan hemen sohbete başlayabilirsin. İstersen kendi anahtarınla (BYOK) Groq, Gemini, OpenRouter, Anthropic gibi sağlayıcıları da ekleyebilirsin.",
      },
      {
        q: "Hesap oluşturmadan kullanabilir miyim?",
        a: "Evet. Giriş yapmadan sohbet edebilirsin — geçmişin yalnızca bu tarayıcıda saklanır. Sohbetlerini birden fazla cihazda senkronlamak istersen ücretsiz bir hesap oluşturman yeterli.",
      },
    ],
  },
  {
    title: "Model ve Sağlayıcılar",
    icon: Cpu,
    faqs: [
      {
        q: "API anahtarım nerede saklanıyor?",
        a: "Yalnızca kendi tarayıcında (localStorage). Anahtarların hiçbir zaman UMAI sunucularına gönderilmez veya sunucuda saklanmaz — istekler doğrudan senin tarayıcından ilgili sağlayıcıya gider.",
      },
      {
        q: "Fusion nedir?",
        a: "Fusion, aynı isteği birden fazla model ile paralel üretip bir hakem modelin en iyi sonucu seçtiği/harmanladığı bir kalite modudur. Ayarlar → Fusion'dan açabilir, hangi modellerin kullanılacağını seçebilirsin.",
      },
      {
        q: "Hangi sağlayıcılar destekleniyor?",
        a: "Pollinations (anahtarsız), Hugging Face, DeepSeek, OpenRouter, Groq, Gemini, Mistral, Cerebras, Together, xAI ve Anthropic dahil çok sayıda sağlayıcı desteklenir — istediğin kadar model profili ekleyip aralarında anında geçiş yapabilirsin.",
      },
    ],
  },
  {
    title: "Stüdyolar",
    icon: LayoutGrid,
    faqs: [
      {
        q: "Hangi stüdyo yüzeyleri var?",
        a: "Tasarım Stüdyosu (web/uygulama/sunum tasarımı), Doküman (Notion tarzı), Anket (Google Forms tarzı), Defter (NotebookLM tarzı kaynak-temelli sohbet), Kartlar (Anki tarzı aralıklı tekrar) ve Kroki (zihin haritası).",
      },
      {
        q: "Tasarım Stüdyosu'nda ürettiğim şeyi nasıl paylaşırım?",
        a: "Tuval üzerindeki çıktıyı HTML olarak indirebilir, PDF'e aktarabilir veya tek tıkla herkese açık bir bağlantıyla yayınlayabilirsin.",
      },
      {
        q: "Stüdyo projelerim nerede saklanıyor?",
        a: "Giriş yapmadıysan bu tarayıcıda; giriş yaptıysan istersen Supabase üzerinden hesabına bağlı olarak tüm cihazlarında senkronlanır.",
      },
    ],
  },
  {
    title: "Hesap ve Senkron",
    icon: UserRound,
    faqs: [
      {
        q: "Sohbetlerim ve ayarlarım nasıl senkronlanıyor?",
        a: "Giriş yaptığında yerel yapılandırman Supabase'teki hesabınla birleştirilir. Farklı bir hesapla giriş yaparsan önceki tarayıcı verisi karışmaz — her hesap kendi verisini görür.",
      },
      {
        q: "Pro abonelik ne sağlıyor?",
        a: "Kendi API anahtarın olmadan hazır kullanım (sunucu tarafı model erişimi) ve sınırsız bulut senkronu sağlar. Free planda kendi anahtarınla (BYOK) tüm çekirdek özellikler zaten sınırsız ve ücretsizdir.",
      },
      {
        q: "Hesabımı nasıl silerim?",
        a: "Ayarlar → Hesap sekmesinden hesabını kalıcı olarak silebilirsin. Bu işlem geri alınamaz; sohbetlerin ve stüdyo projelerin birlikte silinir.",
      },
    ],
  },
  {
    title: "Gizlilik ve Güvenlik",
    icon: ShieldCheck,
    faqs: [
      {
        q: "Verilerim sunucuya gidiyor mu?",
        a: "API anahtarların asla sunucuya gönderilmez. Sohbet mesajların, model isteğini yürütmek için doğrudan seçtiğin sağlayıcıya gider; UMAI sunucusu yalnızca giriş yaptıysan ve senkron açıksa şifreli/kişiye özel (RLS) olarak sohbet geçmişini saklar.",
      },
      {
        q: "Gizlilik politikanız ve kullanım şartlarınız nerede?",
        a: "Ayrıntılar için Gizlilik Politikası, Kullanım Şartları ve Çerez Politikası sayfalarına bakabilirsin — hepsine aşağıdaki bağlantılardan ulaşabilirsin.",
      },
    ],
  },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <MarketingHeader maxWidthClass="max-w-3xl" right={<OpenAppCta />} />

      <main className="max-w-3xl mx-auto px-6 py-16 w-full flex-1">
        <div className="mb-14 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Yardım Merkezi</h1>
          <p className="text-muted mt-4 max-w-lg mx-auto leading-relaxed">
            Sık sorulan sorular. Aradığını bulamazsan doğrudan bize yazabilirsin.
          </p>
        </div>

        <div className="space-y-12">
          {CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-brand/12 border border-brand/20 grid place-items-center text-brand">
                  <cat.icon size={16} />
                </span>
                <h2 className="font-bold text-lg">{cat.title}</h2>
              </div>
              <div className="space-y-3">
                {cat.faqs.map((faq) => (
                  <details key={faq.q} className="group premium-card rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-[15px] list-none hover:text-brand transition-colors">
                      {faq.q}
                      <ChevronDown size={16} className="text-muted transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-3" />
                    </summary>
                    <p className="px-6 pb-5 text-sm text-muted leading-relaxed">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href="/changelog" className="text-brand hover:underline">Değişiklikler</Link>
              <Link href="/privacy" className="text-muted hover:text-ink">Gizlilik</Link>
              <Link href="/terms" className="text-muted hover:text-ink">Kullanım Şartları</Link>
              <Link href="/cookies" className="text-muted hover:text-ink">Çerezler</Link>
            </div>
            <a href="mailto:eneskahveci.bs@gmail.com" className="text-sm text-brand hover:underline">
              eneskahveci.bs@gmail.com
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
