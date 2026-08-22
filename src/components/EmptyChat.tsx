"use client";

import { ArrowRight, History } from "lucide-react";
import { useStore } from "@/lib/store";

/* Saate göre kısa selamlama — boş duruma kişisel/profesyonel bir giriş verir. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/* Sade karşılama ekranı (Claude'un kendi boş-sohbet ekranına paralel,
   Tem 2026 kullanıcı kararı): öneri çipleri ve diğer yüzeylere yönlendiren
   bağlantılar (ör. "Stüdyo'ya geç") kaldırıldı — kullanıcı doğrudan yazar. */
export function EmptyChat() {
  /* Son (gizli olmayan) sohbet — "kaldığın yerden devam" ince bağlantısı için. */
  const chats = useStore((s) => s.chats);
  const selectChat = useStore((s) => s.selectChat);
  const lastChat = chats.find((c) => !c.incognito && c.messages.length > 0);

  return (
    /* ALTA yaslanır (ortaya değil): CoderView boş sohbette composer'ın altına
       bir flex-1 boşluk koyup composer'ı ekranın ortasına taşıyor; karşılama da
       onun hemen üstünde durmalı ki ikisi TEK bir grup gibi okunsun. */
    <div className="flex flex-col items-center justify-end min-h-full px-6 pb-5 pt-10 select-none">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70 mb-2">{greeting()}</div>
      <h2 className="text-[26px] sm:text-[28px] font-extrabold tracking-tight mb-2 text-center text-balance">Ne üzerinde çalışalım?</h2>
      <p className="text-sm text-muted/70 max-w-sm text-center leading-relaxed">
        Bir istek yaz, gerisini hallederim.
      </p>

      {lastChat && (
        <button
          onClick={() => selectChat(lastChat.id)}
          className="group mt-6 inline-flex items-center gap-1.5 text-xs text-muted/70 hover:text-ink transition-colors"
        >
          <History size={13} className="text-brand/70" />
          Kaldığın yerden devam: <span className="font-semibold text-ink/80 max-w-[220px] truncate">{lastChat.title}</span>
          <ArrowRight size={12} className="text-muted/40 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
