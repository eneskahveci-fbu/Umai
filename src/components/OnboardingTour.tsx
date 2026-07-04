"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

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
      title: "Craft'a hoş geldin 👋",
      body: (
        <>
          Ne istediğini <strong className="text-ink">sıradan cümlelerle</strong> yaz — Craft senin için yapsın.
          Yazılım ya da yapay zeka bilmene gerek yok. Kurulum da yok: <strong className="text-ink">ücretsiz</strong> bir
          yapay zeka hazır bekliyor, hemen başlayabilirsin.
        </>
      ),
    },
    {
      icon: <Wand2 size={22} className="text-brand" />,
      title: "İki şey yapabilirsin",
      body: (
        <>
          <strong className="text-ink">Tasarla & üret:</strong> web sitesi, sunum, görsel — bir cümle yeter (Stüdyo).
          <br />
          <strong className="text-ink">Kod & geliştirme:</strong> kod yazdır, düzelt, deponu bağla.
          <br />
          <span className="text-muted/70">İstediğin zaman ikisi arasında geçiş yaparsın.</span>
        </>
      ),
      action: {
        label: "Tasarlamayı dene (Stüdyo)",
        onClick: () => { dismiss(); router.push("/studio"); },
      },
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
      title: "İleri düzey (opsiyonel)",
      body: hasModel ? (
        <>
          İstersen <strong className="text-ink">kendi yapay zeka modelini</strong> ekleyebilir (Gemini, Groq, NVIDIA…),
          GitHub/GitLab deponu bağlayabilirsin. Anahtarların yalnızca
          {" "}<strong className="text-ink">tarayıcında</strong> kalır, bize gönderilmez.
        </>
      ) : (
        <>Ayarlar&apos;dan kendi modelini ekleyebilir, deponu bağlayabilirsin. Anahtarların tarayıcında kalır.</>
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
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-brand hover:bg-branddim text-white font-semibold transition-colors"
          >
            {isLast ? <>Başla <Check size={12} /></> : <>Devam <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
