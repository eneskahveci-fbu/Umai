"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: "E-posta",
  github: "GitHub",
  gitlab: "GitLab",
  google: "Google",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

/* Admin-only "Superadmin" paneli — kim hangi hesapla (e-posta/kullanıcı adı +
   hangi sağlayıcı ile) kayıtlı, ne zaman katılmış, en son ne zaman giriş
   yapmış. AdminAnalytics.tsx ile AYNI desen: servis anahtarı sunucuda yoksa
   (501) ya da admin değilse (403) sessizce bilgilendirici bir not gösterir. */
export function AdminUsers() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ok"; users: AdminUserRow[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      if (!sb) { if (!cancelled) setState({ status: "error", message: "Kimlik doğrulama yapılandırılmamış." }); return; }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { if (!cancelled) setState({ status: "error", message: "Oturum bulunamadı." }); return; }
      try {
        const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setState({ status: "error", message: json.error || `Hata (${res.status})` }); return; }
        setState({ status: "ok", users: json.users ?? [] });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "bilinmeyen hata" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="space-y-3 pt-2 border-t border-line/60">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><ShieldAlert size={16} className="text-brand" /> Superadmin — Kayıtlı Kullanıcılar</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">
          Kim hangi hesapla (e-posta/kullanıcı adı + sağlayıcı) kayıt olmuş, ne zaman katılmış ve en son ne zaman giriş yapmış.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted/60 py-3">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs text-muted/60 py-2">{state.message}</p>
      )}

      {state.status === "ok" && (
        <div className="premium-card rounded-xl divide-y divide-line/40 max-h-96 overflow-y-auto">
          {state.users.length === 0 && (
            <p className="text-xs text-muted/60 p-3">Henüz kayıtlı kullanıcı yok.</p>
          )}
          {state.users.map((u) => (
            <div key={u.id} className="p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink/90 truncate">{u.username || u.email || u.id}</span>
                {u.providers.map((p) => (
                  <span key={p} className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border border-line/60 text-muted/70">
                    {PROVIDER_LABELS[p] ?? p}
                  </span>
                ))}
              </div>
              {u.username && u.email && (
                <div className="text-muted/60 truncate">{u.email}</div>
              )}
              <div className="text-[10px] text-muted/50 flex items-center gap-2">
                <span>Katıldı: {fmtDate(u.createdAt)}</span>
                <span>·</span>
                <span>Son giriş: {fmtDate(u.lastSignInAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
