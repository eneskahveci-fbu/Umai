import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, Crown } from "lucide-react";
import { ProUpgrade } from "@/components/ProUpgrade";

export const metadata: Metadata = {
  title: "Fiyatlandırma",
  description:
    "craft coder fiyatlandırma — kendi anahtarınla (BYOK) hep ücretsiz; Pro ile hazır kullanım + sınırsız bulut senkron.",
};

const FREE = [
  "Kendi API anahtarınla (BYOK) sınırsız kullanım",
  "Tüm sağlayıcılar (Groq, Gemini, OpenRouter, Anthropic…)",
  "Sohbet, coder, terminal, ajan kadrosu",
  "Yerel veri (anahtarlar yalnızca tarayıcında)",
];

const PRO = [
  "Anahtarsız hazır kullanım (sunucu LLM — kendi anahtarın gerekmez)",
  "Sınırsız bulut senkron (sohbet + proje, tüm cihazlar)",
  "Öncelikli sunucu erişimi",
  "Free'deki her şey dahil",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/85 border-b border-line/40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={15} /> craft coder
          </Link>
          <Link
            href="/app"
            className="bg-brand hover:bg-branddim text-[#111110] font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            Uygulamayı Aç
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Basit, şeffaf fiyatlandırma</h1>
          <p className="text-muted mt-4 max-w-xl mx-auto leading-relaxed">
            Kendi anahtarınla (BYOK) craft coder <strong className="text-ink">her zaman ücretsiz</strong>.
            Anahtar uğraşmak istemeyenler için Pro: hazır kullanım + sınırsız bulut senkron.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-line bg-surface p-7 flex flex-col">
            <div className="text-sm font-semibold text-muted">Free</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">₺0</span>
              <span className="text-muted text-sm">/ her zaman</span>
            </div>
            <p className="text-[13px] text-muted/80 mt-1">Kendi anahtarınla (BYOK)</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="text-green shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/app"
              className="mt-7 w-full text-center border border-line hover:border-brand/50 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Ücretsiz Başla
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-brand/40 bg-gradient-to-b from-brand/10 to-transparent p-7 flex flex-col relative">
            <span className="absolute -top-3 left-7 text-[11px] font-bold bg-brand text-[#111110] px-2.5 py-0.5 rounded-full">
              ÖNERİLEN
            </span>
            <div className="text-sm font-semibold text-brand flex items-center gap-1.5">
              <Crown size={15} /> Pro
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">abonelik</span>
            </div>
            <p className="text-[13px] text-muted/80 mt-1">Hazır kullanım + bulut senkron</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {PRO.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="text-brand shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <ProUpgrade />
            </div>
          </div>
        </div>

        {/* SSS */}
        <div className="max-w-2xl mx-auto mt-20">
          <h2 className="text-2xl font-extrabold text-center mb-8">Sık sorulanlar</h2>
          <div className="space-y-5">
            {[
              ["Free gerçekten ücretsiz mi?", "Evet. Kendi API anahtarınla (BYOK) craft coder'ın tüm çekirdek özelliklerini sınırsız ve ücretsiz kullanırsın. Anahtarların yalnızca tarayıcında saklanır."],
              ["Pro ne ekliyor?", "Kendi anahtarın olmadan kullanım (sunucu LLM) ve sınırsız bulut senkron. Yani kurulum/anahtar uğraşı olmadan her cihazda hazır."],
              ["İptal edebilir miyim?", "İstediğin an. Müşteri portalından aboneliğini tek tıkla yönetir/iptal edersin; verilerin kaybolmaz."],
              ["Pro olmazsam ne olur?", "Hiçbir şey kaybetmezsin — kendi anahtarınla (BYOK) her şey çalışmaya devam eder."],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-line/60 bg-surface/50 p-4">
                <div className="font-semibold text-sm mb-1">{q}</div>
                <p className="text-[13px] text-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
