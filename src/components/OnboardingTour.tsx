"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, GitBranch, MessageSquare, Settings, X } from "lucide-react";
import { useStore } from "@/lib/store";

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
  const hasGithub = useStore((s) => s.config.githubAccounts.length > 0);

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

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
      title: "Craft.AI'a hoş geldin",
      body: (
        <>
          Bu, kendi <strong className="text-ink">API anahtarınla</strong> çalışan bir AI kod asistanı.
          OpenAI, Anthropic, Hugging Face veya OpenAI-uyumlu herhangi bir model — sen seç.
          Anahtarın <strong className="text-ink">tarayıcında</strong> kalır, sunucumuza gönderilmez.
        </>
      ),
    },
    {
      icon: <Settings size={22} className="text-brand" />,
      title: "1. Bir model ekle",
      body: hasModel ? (
        <>Harika — bir model zaten ekli. <Check size={13} className="inline text-green" /></>
      ) : (
        <>
          Ayarlar → Model'den bir provider seç, baseURL + API anahtarını gir, "Test" düğmesiyle doğrula.
          Cevap dönüyorsa hazırsın.
        </>
      ),
      action: hasModel ? undefined : {
        label: "Ayarlar'ı aç",
        onClick: () => { setSettingsOpen(true); setVisible(false); },
      },
    },
    {
      icon: <GitBranch size={22} className="text-purple-400" />,
      title: "2. (Opsiyonel) GitHub bağla",
      body: hasGithub ? (
        <>GitHub hesabı bağlı. <Check size={13} className="inline text-green" /></>
      ) : (
        <>
          Kod tabanına özel cevaplar için Ayarlar → GitHub'tan kişisel access token ekle (
          <code className="text-[11px] bg-bgsoft px-1 rounded">repo</code> izni yeter). Sonra sol panelden bir depo seç.
        </>
      ),
    },
    {
      icon: <MessageSquare size={22} className="text-amber-400" />,
      title: "3. İlk sorunu sor",
      body: (
        <>
          Composer'a yaz. <code className="text-[11px] bg-bgsoft px-1 rounded">/</code> ile agent seç,
          {" "}<code className="text-[11px] bg-bgsoft px-1 rounded">@</code> ile dosya mention'la.
          AI birden fazla dosya yazınca, otomatik <strong className="text-ink">çok dosyalı commit</strong> barı çıkar.
        </>
      ),
    },
  ];

  const total = steps.length;
  const cur = steps[step];
  const isLast = step === total - 1;

  const dismiss = () => {
    setOnboardingDone(true);
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={dismiss}
    >
      <div
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
          <h3 className="text-lg font-extrabold mb-1.5">{cur.title}</h3>
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
