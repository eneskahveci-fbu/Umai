"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

const STEPS = [
  {
    title: "Hoş Geldiniz!",
    description:
      "Craft.Coder, yapay zekâ destekli bir kodlama asistanıdır. Kod yazabilir, açıklayabilir ve hata ayıklayabilirsiniz.",
  },
  {
    title: "Model Ekleme",
    description:
      "Kendi API anahtarınızla istediğiniz modeli ekleyin. Tüm anahtarlar yalnızca tarayıcınızda saklanır.",
  },
  {
    title: "GitHub Entegrasyonu",
    description:
      "GitHub deponuza bağlanın, dosyaları gezin, düzenleyin ve doğrudan sohbetten PR açın.",
  },
  {
    title: "Skills & Agents",
    description:
      "Özel kurallar (Skills) ekleyerek yapay zekânın davranışını özelleştirin. Slash komutlarıyla hızlı işlem yapın.",
  },
  {
    title: "Hazırsınız!",
    description:
      'Yeni bir sohbet başlatın ve "Merhaba" deyin. İyi kodlamalar! 🚀',
  },
];

export function OnboardingTour() {
  const open = useStore((s) => s.onboardingOpen);
  const setOpen = useStore((s) => s.setOnboardingOpen);

  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      setOpen(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("craftai_onboarding_done", "1");
      }
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  const close = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("craftai_onboarding_done", "1");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div
        className="bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Başlangıç turu"
      >
        {/* Close */}
        <button
          onClick={close}
          className="absolute top-4 right-4 hover:bg-bgsoft rounded-lg p-1 transition-colors"
          title="Kapat"
          aria-label="Kapat"
        >
          <X size={18} />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i <= step ? "bg-amber-400" : "bg-bgsoft"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold mb-2">{current.title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          {current.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={isFirst}
            className="flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Geri
          </button>

          <span className="text-xs text-muted">
            {step + 1} / {STEPS.length}
          </span>

          <button
            onClick={next}
            className="flex items-center gap-1 px-4 py-2 bg-amber-400 text-black rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors"
          >
            {isLast ? (
              <>
                <Check size={16} />
                Başla
              </>
            ) : (
              <>
                İleri
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
