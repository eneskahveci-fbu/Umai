"use client";

import { useState, useEffect } from "react";

interface Step {
  target: string;
  title: string;
  description: string;
}

const TOUR_STEPS: Step[] = [
  {
    target: "[data-tour='sidebar']",
    title: "Kenar Çubuğu",
    description: "Sohbet geçmişiniz, görünümler ve projeler burada.",
  },
  {
    target: "[data-tour='model-selector']",
    title: "Model Seçici",
    description: "Aktif AI modelini buradan değiştirebilirsiniz.",
  },
  {
    target: "[data-tour='skills']",
    title: "Skills & Özelleştirme",
    description: "AI'nın davranışını özelleştirmek için skills ekleyin.",
  },
  {
    target: "[data-tour='chat-input']",
    title: "Sohbet Girişi",
    description: "Mesajınızı yazın, dosya ekleyin veya web araması yapın.",
  },
];

export function OnboardingTour({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isControlled = open !== undefined;
  const visible = isControlled ? open : isOpen;

  const close = () => {
    if (isControlled) onClose?.();
    else setIsOpen(false);
    setStep(0);
  };

  useEffect(() => {
    // localStorage'da turun daha önce gösterilip gösterilmediğini kontrol et
    const seen = localStorage.getItem("onboarding-seen");
    if (!seen && !isControlled) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isControlled]);

  const finish = () => {
    localStorage.setItem("onboarding-seen", "1");
    close();
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm">
      {/* Hedef vurgusu — basit overlay, gerçek implementasyonda target elementin pozisyonu hesaplanır */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Spotlight efekti burada olacak */}
      </div>

      {/* Tooltip */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md">
        <div className="bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-2xl shadow-2xl p-5 mx-4">
          <div className="text-xs text-[var(--color-brand)] mb-1">
            {step + 1} / {TOUR_STEPS.length}
          </div>
          <h3 className="text-base font-semibold mb-1">{current.title}</h3>
          <p className="text-sm text-[var(--color-ink)]/60 mb-4">{current.description}</p>
          <div className="flex gap-2">
            <button
              onClick={finish}
              className="text-xs text-[var(--color-ink)]/40 hover:text-[var(--color-ink)]/60 transition-colors px-3 py-1.5"
            >
              Atla
            </button>
            <div className="flex-1" />
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-surface)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Geri
              </button>
            )}
            {step < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 text-xs rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity"
              >
                İleri
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-4 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:opacity-90 transition-opacity"
              >
                Bitir ✅
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
