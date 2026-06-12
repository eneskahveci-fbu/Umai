"use client";

import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";

interface Step {
  title: string;
  description: string;
  target?: string; // CSS selector for highlight (simplified: just text label)
}

const steps: Step[] = [
  {
    title: "Hoş Geldiniz! 👋",
    description: "Craft.Coder, tarayıcıda çalışan Türkçe yapay zekâ kodlama asistanıdır. Bu kısa turda temel özellikleri keşfedeceğiz.",
  },
  {
    title: "Sohbet Görünümü",
    description: "Yapay zekâ ile sohbet edin, kod yazdırın ve hata ayıklayın. Gizli sohbet modu hiçbir yere kaydedilmez.",
  },
  {
    title: "Coder Görünümü",
    description: "Sol panelde dosya ağacı, ortada Monaco editör ve sohbet, altta terminal ile tam bir geliştirme ortamı.",
  },
  {
    title: "Skills ⚡",
    description: "Skills butonu ile AI'ın davranışını özelleştirin. Manuel kurallar ekleyin, referans dosyaları yükleyin ve agent'ları yönetin.",
  },
  {
    title: "Ayarlar ⚙️",
    description: "Model ekleyin (OpenAI, DeepSeek, Gemini, Groq, Ollama...), tema seçin, GitHub bağlantısı kurun.",
  },
  {
    title: "Kısayollar ⌨️",
    description: "⌘N yeni sohbet, ⌘K komut paleti, ⌘B kenar çubuğu, ⌘, ayarlar — hepsi parmaklarınızın ucunda.",
  },
  {
    title: "Hazırsınız! 🚀",
    description: "İlk sohbetinizi başlatın veya Coder görünümüne geçip kod yazmaya başlayın. İyi çalışmalar!",
  },
];

export function OnboardingTour() {
  const open = useStore((s) => s.onboardingOpen);
  const setOnboardingOpen = useStore((s) => s.setOnboardingOpen);
  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const setOnboardingCompleted = useStore((s) => s.setOnboardingCompleted);

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const close = useCallback(() => {
    if (step === steps.length - 1) {
      setOnboardingCompleted(true);
    }
    setOnboardingOpen(false);
  }, [step, setOnboardingOpen, setOnboardingCompleted]);

  const next = useCallback(() => {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else close();
  }, [step, close]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const current = steps[step];

  // İlk kez otomatik göster (sadece onboardingCompleted false ise)
  useEffect(() => {
    if (!onboardingCompleted && typeof window !== "undefined") {
      const timer = setTimeout(() => setOnboardingOpen(true), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-4 pb-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-amber-400" : "bg-bgsoft border border-line"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <h3 className="text-lg font-bold mb-2">{current.title}</h3>
          <p className="text-sm text-muted leading-relaxed">{current.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <button
            onClick={close}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
          >
            <X size={12} />
            Atla
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-bgsoft hover:bg-bgsoft/80 text-ink transition-colors"
              >
                <ChevronLeft size={12} />
                Geri
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-400 text-black hover:bg-amber-300 transition-colors"
            >
              {step === steps.length - 1 ? (
                <>
                  <Check size={12} />
                  Bitir
                </>
              ) : (
                <>
                  İleri
                  <ChevronRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
