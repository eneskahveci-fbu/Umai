"use client";

import Link from "next/link";
import { ArrowRight, Code2, GitBranch, History, MessageCircle, Sparkles, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";

interface EmptyChatProps {
  hasModel: boolean;
  hasRepo: boolean;
  onAddModel: () => void;
  onPrompt: (text: string) => void;
}

const SAMPLE_PROMPTS = [
  { icon: Code2, label: "Kodumu daha iyi yap", text: "Aşağıdaki kodu daha okunabilir ve test edilebilir hâle getir:\n\n" },
  { icon: Sparkles, label: "Yeni bir özellik ekle", text: "Şu özelliği eklemek istiyorum, nasıl yaparım: " },
  { icon: GitBranch, label: "Bir hatayı çöz", text: "Şu hatayı alıyorum, sebebi ne olabilir:\n\n" },
  { icon: MessageCircle, label: "Bir şey açıkla / öğren", text: "Şunu basitçe açıklar mısın: " },
];

/* Saate göre kısa selamlama — boş duruma kişisel/profesyonel bir giriş verir. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function EmptyChat({ onPrompt }: EmptyChatProps) {
  /* Son (gizli olmayan) sohbet — "kaldığın yerden devam" ince bağlantısı için. */
  const chats = useStore((s) => s.chats);
  const selectChat = useStore((s) => s.selectChat);
  const lastChat = chats.find((c) => !c.incognito && c.messages.length > 0);

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center h-full px-6 py-10 select-none">
      {/* Marka tonlu, yavaş süzülen ışıma — yalnız boş sahnede. */}
      <div className="aurora absolute inset-0 -z-10" aria-hidden />

      <div className="animate-rise text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70 mb-2">{greeting()} 👋</div>
      <h2 className="animate-rise text-[26px] sm:text-[28px] font-extrabold tracking-tight mb-2 text-center text-balance" style={{ animationDelay: "60ms" }}>Ne üzerinde çalışalım?</h2>
      <p className="animate-rise text-sm text-muted/70 max-w-sm text-center leading-relaxed mb-6" style={{ animationDelay: "120ms" }}>
        Sıradan cümlelerle anlat — gerisini Craft halletsin.
      </p>

      {/* Kompakt öneri çipleri — büyük kart yığını yerine sade bir sıra. */}
      <div className="animate-rise flex flex-wrap items-center justify-center gap-2 max-w-md mb-6" style={{ animationDelay: "180ms" }}>
        {SAMPLE_PROMPTS.map(({ icon: Icon, label, text }) => (
          <button
            key={label}
            onClick={() => onPrompt(text)}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-line bg-surface/60 text-[13px] font-medium text-ink/75 hover:text-ink hover:border-brand/40 hover:bg-surface transition-colors"
          >
            <Icon size={13} className="text-brand/80" />
            {label}
          </button>
        ))}
      </div>

      {/* İnce bağlantılar: devam + Stüdyo köprüsü (kart değil). */}
      <div className="animate-rise flex flex-col items-center gap-2 text-xs" style={{ animationDelay: "240ms" }}>
        {lastChat && (
          <button
            onClick={() => selectChat(lastChat.id)}
            className="group inline-flex items-center gap-1.5 text-muted/70 hover:text-ink transition-colors"
          >
            <History size={13} className="text-brand/70" />
            Kaldığın yerden devam: <span className="font-semibold text-ink/80 max-w-[220px] truncate">{lastChat.title}</span>
            <ArrowRight size={12} className="text-muted/40 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
        <Link href="/studio" className="group inline-flex items-center gap-1.5 text-muted/60 hover:text-ink transition-colors">
          <Wand2 size={13} className="text-brand/70" />
          Kod değil, bir şey tasarlamak mı istiyorsun? <span className="text-ink/70 font-medium">Stüdyo&apos;ya geç</span>
          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
