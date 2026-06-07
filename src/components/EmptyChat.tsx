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
      <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/25 grid place-items-center mb-5 shadow-lg shadow-brand/10">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M14 3L24 9V19L14 25L4 19V9L14 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" className="text-brand" />
          <circle cx="14" cy="14" r="3.2" fill="currentColor" className="text-brand" fillOpacity="0.8" />
        </svg>
      </div>

      <h2 className="text-2xl font-extrabold tracking-tight mb-1.5">Ne üzerinde çalışalım?</h2>
      <p className="text-sm text-muted/60 max-w-md text-center leading-relaxed mb-6">
        Dosya ekle, kod yapıştır veya bir soru sor.
        <br />
        <span className="text-muted/40 text-xs">/ ile agent seç · @ ile dosya mention</span>
      </p>

      {!hasModel ? (
        <button
          onClick={onAddModel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-branddim text-white text-sm font-semibold transition-colors shadow-sm shadow-brand/20"
        >
          <Settings size={14} />
          İlk olarak bir model ekle
          <ArrowRight size={14} />
        </button>
      ) : (
        <div className="w-full max-w-xl">
          <div className="text-[10px] uppercase tracking-widest text-muted/40 mb-2 text-center font-bold">
            Hızlı başlangıç
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_PROMPTS.map(({ icon: Icon, label, text }) => (
              <button
                key={label}
                onClick={() => onPrompt(text)}
                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-line/60 hover:border-brand/40 hover:bg-bgsoft/40 text-left transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-bgsoft/60 grid place-items-center text-muted/60 group-hover:text-brand group-hover:bg-brand/10 transition-colors shrink-0">
                  <Icon size={13} />
                </span>
                <span className="text-[12px] text-muted/80 group-hover:text-ink transition-colors leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
          {!hasRepo && (
            <p className="text-[11px] text-muted/40 text-center mt-4 leading-relaxed">
              💡 İpucu: Sol panelden bir <strong className="text-muted/70">GitHub deposu</strong> bağlarsan kod tabanına özel cevaplar alırsın.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
