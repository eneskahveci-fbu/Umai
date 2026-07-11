"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function AuthButton() {
  const userEmail = useStore((s) => s.userEmail);
  const [busy, setBusy] = useState(false);

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
      <button
        onClick={() => { void signOut(); }}
        title={`${userEmail} · Çıkış yap`}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-line hover:border-brand/40 hover:bg-bgsoft text-sm transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-brand/15 border border-brand/25 grid place-items-center text-brand text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="flex-1 truncate text-left text-muted">{userEmail}</span>
        <LogOut size={14} className="text-muted/60 shrink-0" />
      </button>
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
