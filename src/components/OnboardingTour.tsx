"use client";

// src/components/OnboardingTour.tsx — İlk kullanım rehberi turu

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";

interface TourStep {
  target: string; // CSS selector açıklaması (görsel değil, metinsel)
  title: string;
  description: string;
  position: "bottom" | "top" | "right" | "left";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "üst bar",
    title: "Model Seçici",
    description:
      "Üst bardan aktif yapay zeka modelini seçebilir, yeni modeller ekleyebilirsiniz.",
    position: "bottom",
  },
  {
    target: "sohbet alanı",
    title: "Sohbet",
    description:
      "Mesajınızı yazın, Enter'a basın. Shift+Enter ile alt satıra geçin. Dosya ekleyebilir, sesli giriş yapabilirsiniz.",
    position: "top",
  },
  {
    target: "kenar çubuğu",
    title: "Sohbet Geçmişi",
    description:
      "Sol tarafta sohbet geçmişiniz bulunur. Gizli sohbet başlatabilir, mesajları paylaşabilirsiniz.",
    position: "right",
  },
  {
    target: "alt araçlar",
    title: "Araçlar",
    description:
      "Web arama, Canvas önizleme ve dosya ekleme araçlarını kullanın. Coder görünümünde kod editörü ve terminal mevcuttur.",
    position: "top",
  },
  {
    target: "ayarlar",
    title: "Ayarlar",
    description:
      "⚙️ Ayarlar menüsünden modelleri yönetebilir, Git hesaplarınızı bağlayabilir, temayı ve yanıt stilini özelleştirebilirsiniz.",
    position: "bottom",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const onboardingOpen = useStore((s) => s.onboardingOpen);
  const setOnboardingOpen = useStore((s) => s.setOnboardingOpen);

  const current = TOUR_STEPS[step];

  const next = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setOnboardingOpen(false);
      setStep(0);
    }
  }, [step, setOnboardingOpen]);

  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const skip = useCallback(() => {
    setOnboardingOpen(false);
    setStep(0);
  }, [setOnboardingOpen]);

  if (!onboardingOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center pb-8 bg-bg/80 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="Kullanım rehberi"
    >
      <div className="w-full max-w-md mx-4 bg-surface border border-line rounded-2xl shadow-2xl p-5 space-y-4">
        {/* Adım göstergesi */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <button
            onClick={skip}
            className="p-1 hover:bg-bgsoft rounded-lg transition-colors text-muted hover:text-ink"
            title="Turu kapat"
            aria-label="Turu kapat"
          >
            <X size={14} />
          </button>
        </div>

        {/* İlerleme çubuğu */}
        <div className="h-1 bg-bgsoft rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{
              width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
            }}
          />
        </div>

        {/* İçerik */}
        <div>
          <h3 className="text-base font-semibold text-ink mb-1.5">
            {current.title}
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            {current.description}
          </p>
          <p className="text-[10px] text-muted mt-2 opacity-60">
            📍 Konum: {current.target}
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-line text-muted hover:text-ink hover:bg-bgsoft transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={12} />
            Geri
          </button>

          <button
            onClick={next}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-xl bg-amber-400 text-black hover:bg-amber-300 transition-colors"
          >
            {step < TOUR_STEPS.length - 1 ? (
              <>
                İleri
                <ArrowRight size={12} />
              </>
            ) : (
              <>
                Tamam
                <Check size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
