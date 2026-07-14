"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/* İkon-yalnız hesap düğmesi (Claude'un sol alt köşedeki yuvarlak avatar
   rozeti gibi) — tıklayınca aynı yerde yukarı açılan bir menü gösterir. */
export function AuthButton() {
  const userEmail = useStore((s) => s.userEmail);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  /* Dışarı tıklama / Escape ile kapan — sidebar'daki sohbet "..." menüsüyle
     aynı hafif desen (tam modal/focus-trap gerekmiyor, küçük bir açılır panel). */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!supabaseConfigured) {
    return (
      <div
        title="Yerel mod · sohbetler bu tarayıcıda"
        className="w-10 h-10 rounded-full border border-line bg-bgsoft grid place-items-center text-muted/60 shrink-0"
      >
        <UserRound size={16} />
      </div>
    );
  }

  const signOut = async () => {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
  };

  if (userEmail) {
    const initial = userEmail.trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="relative" ref={rootRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={userEmail}
          title={userEmail}
          className="w-10 h-10 rounded-full bg-brand/15 border border-brand/25 grid place-items-center text-brand text-sm font-bold hover:bg-brand/25 transition-colors shrink-0"
        >
          {initial}
        </button>
        {menuOpen && (
          <div className="animate-fade-in absolute bottom-full left-0 mb-1.5 z-20 w-56 rounded-xl border border-line bg-surface elev-2 overflow-hidden text-sm">
            <div className="px-3 py-2.5 border-b border-line/50">
              <p className="text-[11px] text-muted/60">Oturum açık</p>
              <p className="truncate font-medium text-ink">{userEmail}</p>
            </div>
            {/* Ayarlar'ın TEK sidebar girişi burası (kullanıcı kararı):
               sidebar gövdesindeki bağımsız Ayarlar butonu kaldırıldı,
               aynı hedefe iki komşu girdi kafa karıştırıyordu. */}
            <button
              onClick={() => { setMenuOpen(false); router.push("/settings"); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/70 text-left text-ink/85"
            >
              <Settings size={14} className="text-muted/70" /> Ayarlar
            </button>
            <button
              onClick={() => { setMenuOpen(false); void signOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bgsoft/70 text-left text-red-400"
            >
              <LogOut size={14} /> Çıkış yap
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setBusy(true); window.location.href = "/login"; }}
      disabled={busy}
      title="Giriş Yap / Kayıt Ol"
      aria-label="Giriş Yap / Kayıt Ol"
      className="w-10 h-10 rounded-full border border-line bg-bgsoft hover:border-brand grid place-items-center disabled:opacity-50 shrink-0 transition-colors"
    >
      <LogIn size={16} />
    </button>
  );
}
