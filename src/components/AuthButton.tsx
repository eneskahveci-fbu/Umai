"use client";

import { useState } from "react";
import { LogIn, LogOut, User } from "lucide-react";
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
    return (
      <button
        onClick={() => { void signOut(); }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm"
      >
        <User size={15} className="text-brand" />
        <span className="flex-1 truncate text-left text-muted">{userEmail}</span>
        <LogOut size={15} className="text-muted" />
      </button>
    );
  }

  return (
    <button
      onClick={() => { window.location.href = "/login"; }}
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bgsoft hover:border-brand text-sm font-semibold disabled:opacity-50"
    >
      <LogIn size={15} />
      Giriş Yap / Kayıt Ol
    </button>
  );
}
