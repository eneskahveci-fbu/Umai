"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

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
      <div className="text-xs text-muted px-2 py-1.5 rounded-lg bg-bgsoft border border-line text-center">
        Yerel mod · sohbetler bu tarayıcıda
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
          title={userEmail}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-line hover:border-brand/40 hover:bg-bgsoft text-sm transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-brand/15 border border-brand/25 grid place-items-center text-brand text-xs font-bold shrink-0">
            {initial}
          </span>
          <span className="flex-1 truncate text-left text-muted">{userEmail}</span>
        </button>
        {menuOpen && (
          <div className="animate-fade-in absolute bottom-full left-0 right-0 mb-1.5 z-20 rounded-xl border border-line bg-surface elev-2 overflow-hidden text-sm">
            <div className="px-3 py-2.5 border-b border-line/50">
              <p className="text-[11px] text-muted/60">Oturum açık</p>
              <p className="truncate font-medium text-ink">{userEmail}</p>
            </div>
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
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm font-semibold disabled:opacity-50"
    >
      <LogIn size={15} />
      {busy ? "Yönlendiriliyor…" : "Giriş Yap / Kayıt Ol"}
    </button>
  );
}
