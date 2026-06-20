"use client";

import { ArrowRight, Code2, GitBranch, MessageCircle, Settings, Sparkles } from "lucide-react";

interface EmptyChatProps {
  hasModel: boolean;
  hasRepo: boolean;
  onAddModel: () => void;
  onPrompt: (text: string) => void;
}

const SAMPLE_PROMPTS = [
  { icon: Code2, label: "Bu fonksiyonu yeniden yaz", text: "Aşağıdaki fonksiyonu daha okunabilir ve test edilebilir hâle getir:\n\n" },
  { icon: Sparkles, label: "Bir özellik ekle", text: "Bu projeye şu özelliği eklemek istiyorum: " },
  { icon: GitBranch, label: "Bir hatayı incele", text: "Şu hatayı alıyorum, sebebi ne olabilir:\n\n" },
  { icon: MessageCircle, label: "Mimari fikir tartış", text: "Şu konuda nasıl bir mimari kurardın: " },
];

export function EmptyChat({ hasModel, hasRepo, onAddModel, onPrompt }: EmptyChatProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 select-none">
      {/* Logo orb — gradyan yüzey + marka parıltısı (gerçek derinlik) */}
      <div
        className="w-16 h-16 rounded-full grid place-items-center mb-6 text-3xl text-brand"
        style={{
          background: "linear-gradient(160deg, color-mix(in srgb, var(--color-brand) 16%, var(--color-surface)), var(--color-surface))",
          border: "1px solid color-mix(in srgb, var(--color-brand) 28%, var(--color-line))",
          boxShadow: "0 10px 34px -10px color-mix(in srgb, var(--color-brand) 45%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        ✦
      </div>

      <h2 className="text-[27px] font-extrabold tracking-tight mb-2 text-center">Ne üzerinde çalışalım?</h2>
      <p className="text-sm text-muted/70 max-w-md text-center leading-relaxed mb-7">
        Dosya ekle, kod yapıştır veya bir soru sor.
        <br />
        <span className="text-muted/45 text-xs">/ ile agent seç · @ ile dosya mention</span>
      </p>

      {!hasModel ? (
        <button
          onClick={onAddModel}
          className="btn-brand-glow flex items-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-bold transition-transform hover:-translate-y-0.5"
        >
          <Settings size={15} />
          İlk olarak bir model ekle
          <ArrowRight size={15} />
        </button>
      ) : (
        <div className="w-full max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted/45 mb-2.5 text-center font-bold">
            Hızlı başlangıç
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {SAMPLE_PROMPTS.map(({ icon: Icon, label, text }) => (
              <button
                key={label}
                onClick={() => onPrompt(text)}
                className="group premium-card flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40"
              >
                <span className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/15 grid place-items-center text-brand shrink-0 transition-colors group-hover:bg-brand/18">
                  <Icon size={15} />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-ink/80 group-hover:text-ink transition-colors leading-tight">
                  {label}
                </span>
                <ArrowRight
                  size={14}
                  className="text-transparent group-hover:text-brand/70 -translate-x-1 group-hover:translate-x-0 transition-all duration-150 shrink-0"
                />
              </button>
            ))}
          </div>
          {!hasRepo && (
            <p className="text-[11px] text-muted/45 text-center mt-5 leading-relaxed">
              💡 İpucu: Sol panelden bir <strong className="text-brand/80">GitHub deposu</strong> bağlarsan kod tabanına özel cevaplar alırsın.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
