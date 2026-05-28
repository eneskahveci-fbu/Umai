"use client";

import { useState } from "react";
import { ArrowRight, Bot, Check, Code2, FolderGit2, KeyRound, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

const STEPS = [
  {
    icon: Code2,
    title: "craft.ai'ya hoş geldin",
    body:
      "Claude Code tarzı bir web kodlama asistanı. Modelini sen seçersin, kendi anahtarınla çalışır, " +
      "konuşmaların tarayıcında ve hesabında saklanır.",
  },
  {
    icon: KeyRound,
    title: "Önce bir model ekle",
    body:
      "Ayarlar'dan bir model bağla — DeepSeek, OpenRouter, OpenAI uyumlu herhangi bir sağlayıcı çalışır. " +
      "Anahtarın yalnızca senin tarayıcında saklanır; sunucumuza gönderilmez.",
  },
  {
    icon: FolderGit2,
    title: "Repo veya dosya bağla",
    body:
      "GitHub deposunu bağla → soldaki Dosyalar panelinden dosyalara tıkla, bağlama eklensin. " +
      "Veya kendi dosyalarını sürükle-bırak yap.",
  },
  {
    icon: Sparkles,
    title: "Slash komutları kullan",
    body:
      "Composer'da `/` yazınca özelleşmiş agentlar açılır: /explain, /refactor, /test, /fix, /review, /docs. " +
      "Her biri özel sistem prompt'uyla çalışır.",
  },
];

export function Onboarding() {
  const onboardingDone = useStore((s) => s.onboardingDone);
  const setOnboardingDone = useStore((s) => s.setOnboardingDone);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [step, setStep] = useState(0);

  if (onboardingDone) return null;

  const isLast = step === STEPS.length - 1;
  const Icon = STEPS[step].icon;

  const finish = () => {
    setOnboardingDone(true);
  };
  const finishAndOpenSettings = () => {
    setOnboardingDone(true);
    setSettingsOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-bg/85 backdrop-blur-md grid place-items-center px-4 animate-modal-bg">
      <div className="w-full max-w-md bg-surface border border-line rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="px-7 pt-8 pb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand/10 border border-brand/25 grid place-items-center">
            <Icon size={26} className="text-brand" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">{STEPS[step].title}</h2>
          <p className="text-sm text-muted mt-2.5 leading-relaxed">{STEPS[step].body}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-brand" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-7 pb-7 gap-3">
          <button
            onClick={finish}
            className="text-xs text-muted/60 hover:text-muted transition-colors"
          >
            Geç
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl border border-line/60 hover:border-line text-sm text-muted hover:text-ink transition-colors"
              >
                Geri
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm transition-colors"
              >
                İleri <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={finishAndOpenSettings}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-branddim text-white font-semibold text-sm transition-colors"
              >
                <Check size={14} /> Başla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
