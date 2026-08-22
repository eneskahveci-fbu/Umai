"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, MessageSquare, Sparkles, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";

interface Step {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: { label: string; onClick: () => void };
}

export function OnboardingTour() {
  const onboardingDone = useStore((s) => s.onboardingDone);
  const setOnboardingDone = useStore((s) => s.setOnboardingDone);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const hasModel = useStore((s) => s.config.models.length > 0);

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    setOnboardingDone(true);
    setVisible(false);
  };
  useModalA11y(modalRef, visible, dismiss);

  /* Show on first run only — defer one tick so the rest of the UI has
     mounted (the spotlight feels weirder on a blank screen). */
  useEffect(() => {
    if (onboardingDone) return;
    const t = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(t);
  }, [onboardingDone]);

  if (!visible || onboardingDone) return null;

  const steps: Step[] = [
    {
      icon: <span className="text-2xl">◈</span>,
      title: "UMAI'ye hoş geldin 👋",
      body: (
        <>
          Ne istediğini <strong className="text-ink">sıradan cümlelerle</strong> yaz — UMAI senin için yapsın.
          Yazılım ya da yapay zeka bilmene gerek yok. Kurulum da yok: <strong className="text-ink">ücretsiz</strong> bir
          yapay zeka hazır bekliyor, hemen başlayabilirsin.
        </>
      ),
    },
    {
      icon: <Wand2 size={22} className="text-brand" />,
      title: "Sohbet et, kod yazdır",
      /* prompt.md 3a: onboarding'de Stüdyo'ya kodlama/sohbetle EŞİT ağırlık
         verilemez ve birincil CTA her zaman "sohbete başla / kod yaz" olmalı.
         Önceki hâli ("İki şey yapabilirsin" + tek eylem olarak "Tasarlamayı
         dene (Stüdyo)") bu kuralı iki yönden de çiğniyordu. Stüdyo tek satırlık
         bir dipnot olarak KALIYOR — kaldırılmıyor (3b), yalnız öne çıkarılmıyor. */
      body: (
        <>
          Ne istediğini yaz: <strong className="text-ink">soru sor</strong>, bir metni özetlet,
          {" "}<strong className="text-ink">kod yazdır</strong>, hatanı bulup düzelttir.
          {" "}GitHub/GitLab deponu bağlarsan dosyalarınla doğrudan çalışır.
          <br />
          <span className="text-muted/70">Tasarım, sunum ve doküman için Stüdyo da var — sol menüden ulaşırsın.</span>
        </>
      ),
    },
    {
      icon: <MessageSquare size={22} className="text-brand" />,
      title: "Sadece yaz",
      body: (
        <>
          Aşağıdaki kutuya ne istediğini yaz ve gönder. Sonucu beğenmezsen
          {" "}<strong className="text-ink">&quot;daha sade yap&quot;</strong>, <strong className="text-ink">&quot;rengi değiştir&quot;</strong> gibi
          konuşarak düzeltebilirsin. Denemekten çekinme — her şey geri alınabilir.
        </>
      ),
    },
    {
      icon: <Sparkles size={22} className="text-brand" />,
      /* "İleri düzey (opsiyonel)" başlığı, ürünün EN GÜÇLÜ kozunu (kendi
         ücretsiz anahtarınla çok daha güçlü bir model çalıştırmak) küçültüyordu.
         Kullanıcı bunu görmeden zayıf varsayılanla deneyip ayrılabiliyor. */
      title: "Modeli güçlendir (ücretsiz)",
      body: hasModel ? (
        <>
          Hazır gelen model ücretsiz ama <strong className="text-ink">mütevazı</strong>. Google Gemini, Groq ya da
          Cerebras&apos;tan <strong className="text-ink">ücretsiz</strong> bir anahtar alıp (kredi kartı istemez, ~30 saniye)
          çok daha güçlü bir modele geçebilirsin. Anahtarın yalnızca
          {" "}<strong className="text-ink">senin tarayıcında</strong> kalır — bize gönderilmez.
          <br />
          <span className="text-muted/70">Sohbet ekranındaki “Daha güçlü bir model bağla” bağlantısı da aynı yere götürür.</span>
        </>
      ) : (
        <>
          Ücretsiz bir anahtarla (Gemini/Groq/Cerebras) çok daha güçlü bir modele geçebilirsin.
          Anahtarın yalnızca tarayıcında kalır.
        </>
      ),
      action: {
        label: "Ayarlar'ı aç",
        onClick: () => { setSettingsOpen(true); setVisible(false); },
      },
    },
  ];

  const total = steps.length;
  const cur = steps[step];
  const isLast = step === total - 1;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={dismiss}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl shadow-brand/10 animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/50">
            Tanıtım · {step + 1} / {total}
          </div>
          <button
            onClick={dismiss}
            title="Atla"
            className="text-muted/50 hover:text-ink p-1 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-bgsoft grid place-items-center mb-4 shadow-sm">
            {cur.icon}
          </div>
          <h3 id="onboarding-title" className="text-lg font-extrabold mb-1.5">{cur.title}</h3>
          <p className="text-sm text-muted/80 leading-relaxed">{cur.body}</p>
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          {/* progress dots */}
          <div className="flex items-center gap-1.5 flex-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === step ? "w-6 bg-brand" : i < step ? "w-1.5 bg-brand/40" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>

          {cur.action && (
            <button
              onClick={cur.action.onClick}
              className="text-xs px-3 py-1.5 rounded-lg border border-line hover:border-brand/40 text-muted hover:text-ink transition-colors"
            >
              {cur.action.label}
            </button>
          )}

          <button
            onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-brand hover:bg-branddim text-[#111110] font-semibold transition-colors"
          >
            {isLast ? <>Başla <Check size={12} /></> : <>Devam <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
