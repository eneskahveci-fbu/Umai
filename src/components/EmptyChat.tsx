"use client";

import Link from "next/link";
import { ArrowRight, Check, Code2, GitBranch, History, MessageCircle, Settings, Sparkles, Wand2 } from "lucide-react";
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

/* İlk kullanım kontrol listesi adımı. */
function Step({ done, label, hint, onClick }: { done: boolean; label: string; hint?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={done || !onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-colors ${done ? "opacity-60" : onClick ? "hover:bg-bgsoft" : ""}`}
    >
      <span className={`w-5 h-5 rounded-full grid place-items-center border shrink-0 ${done ? "bg-brand border-brand text-white" : "border-line text-transparent"}`}>
        <Check size={11} />
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${done ? "line-through text-muted" : "text-ink/85"}`}>{label}</span>
        {hint && !done && <span className="block text-[11px] text-muted/55">{hint}</span>}
      </span>
      {!done && onClick && <ArrowRight size={13} className="ml-auto text-muted/40 shrink-0" />}
    </button>
  );
}

export function EmptyChat({ hasModel, hasRepo, onAddModel, onPrompt }: EmptyChatProps) {
  /* Son (gizli olmayan) sohbet — "kaldığın yerden devam" kartı için. */
  const chats = useStore((s) => s.chats);
  const selectChat = useStore((s) => s.selectChat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const lastChat = chats.find((c) => !c.incognito && c.messages.length > 0);
  const hasChatted = chats.some((c) => c.messages.length > 0);
  /* Karşılama: 3 adımdan en az biri eksikse göster (hepsi tamamsa gizlenir). */
  const showChecklist = !hasModel || !hasChatted || !hasRepo;

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center h-full px-6 py-10 select-none">
      {/* Marka tonlu, yavaş süzülen ışıma — yalnız boş sahnede (mesaj gelince kaybolur). */}
      <div className="aurora absolute inset-0 -z-10" aria-hidden />
      {/* Logo orb — gradyan yüzey + marka parıltısı (gerçek derinlik) */}
      <div
        className="w-16 h-16 rounded-full grid place-items-center mb-5 text-3xl text-brand animate-[pulse_4s_ease-in-out_infinite]"
        style={{
          background: "linear-gradient(160deg, color-mix(in srgb, var(--color-brand) 16%, var(--color-surface)), var(--color-surface))",
          border: "1px solid color-mix(in srgb, var(--color-brand) 28%, var(--color-line))",
          boxShadow: "0 10px 34px -10px color-mix(in srgb, var(--color-brand) 45%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        ✦
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70 mb-1.5">{greeting()} 👋</div>
      <h2 className="text-[27px] font-extrabold tracking-tight mb-2 text-center text-balance">Ne üzerinde çalışalım?</h2>
      <p className="text-sm text-muted/70 max-w-md text-center leading-relaxed mb-4">
        Bir soru sor, kod yapıştır ya da dosya ekle — sıradan cümlelerle anlat, gerisini Craft halletsin.
        <br />
        <span className="text-muted/45 text-xs">/ ile agent seç · @ ile dosya ekle · &quot;skill indir &lt;url&gt;&quot; ile eğitim seti yükle</span>
      </p>

      {/* Yaratıcı işler için köprü — buraya varsayılan düşen, kod yazmayacak
          kullanıcı tıkanmasın (akıllı ayrımın diğer yolu). */}
      <Link
        href="/studio"
        className="group inline-flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-full border border-line bg-surface/70 text-muted hover:text-ink hover:border-brand/40 transition-colors mb-7"
      >
        <Wand2 size={13} className="text-brand" />
        Kod değil, bir şey <span className="text-ink/80 font-semibold">tasarlamak</span> mı istiyorsun? Stüdyo&apos;ya geç
        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {!hasModel ? (
        <div className="w-full max-w-md premium-card rounded-2xl p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-brand/70 font-bold px-3 pt-1 pb-1.5 flex items-center gap-1.5">
            <Settings size={11} /> Başlarken — 3 adım
          </div>
          <Step done={hasModel} label="Ücretsiz bir model bağla" hint="60 saniye: Gemini · Groq · NVIDIA anahtarı yapıştır" onClick={onAddModel} />
          <Step done={hasChatted} label="İlk sorunu sor" hint="kod yapıştır ya da bir şey üretmesini iste" />
          <Step done={hasRepo} label="Deponu bağla (opsiyonel)" hint="kod tabanına özel yanıtlar için GitHub/GitLab" onClick={() => setSettingsOpen(true)} />
        </div>
      ) : (
        <div className="w-full max-w-xl">
          {/* Kurulum bitmediyse kompakt kontrol listesi */}
          {showChecklist && (
            <div className="premium-card rounded-2xl p-2 mb-4">
              <Step done={hasModel} label="Model bağlandı" onClick={onAddModel} />
              <Step done={hasChatted} label="İlk sorunu sor" hint="aşağıdaki hızlı başlangıçlardan birini dene" />
              <Step done={hasRepo} label="Deponu bağla (opsiyonel)" hint="kod tabanına özel yanıtlar" onClick={() => setSettingsOpen(true)} />
            </div>
          )}
          {/* Kaldığın yerden devam — son sohbet */}
          {lastChat && (
            <button
              onClick={() => selectChat(lastChat.id)}
              className="group premium-card w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left mb-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40"
            >
              <span className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/15 grid place-items-center text-brand shrink-0">
                <History size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-muted/50 font-bold">Kaldığın yerden devam et</span>
                <span className="block text-[13px] font-semibold text-ink/85 truncate">{lastChat.title}</span>
              </span>
              <ArrowRight size={14} className="text-muted/40 group-hover:text-brand/70 transition-colors shrink-0" />
            </button>
          )}

          <div className="text-[10px] uppercase tracking-[0.18em] text-muted/45 mb-2.5 text-center font-bold">
            Hızlı başlangıç
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SAMPLE_PROMPTS.map(({ icon: Icon, label, text }) => (
              <button
                key={label}
                onClick={() => onPrompt(text)}
                className="group premium-card flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40"
              >
                <span className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/15 grid place-items-center text-brand shrink-0 transition-colors group-hover:bg-brand/18">
                  <Icon size={15} />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-ink/80 group-hover:text-ink transition-colors leading-snug">
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
