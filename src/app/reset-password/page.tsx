"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";

/* Şifre sıfırlama — YALNIZ /auth/callback'in (bkz. route.ts) bir kurtarma
   (recovery) kodunu oturuma çevirip buraya yönlendirdiği durumda anlamlıdır:
   o noktada kullanıcı ZATEN oturumludur, burası yalnız updateUser({password})
   çağırır. Doğrudan bu sayfaya (linksiz) gelen oturumsuz kullanıcıya net bir
   "bağlantı geçersiz" mesajı gösterilir — boş bir form değil. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      if (cancelled) return;
      setHasSession(!!session);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    setError("");
    if (password.length < 8) { setError("Şifre en az 8 karakter olmalı."); return; }
    if (password !== confirm) { setError("Şifreler eşleşmiyor."); return; }

    setLoading(true);
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }
    const { error: err } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }

    setSuccess(true);
    setTimeout(() => { router.replace("/app"); router.refresh(); }, 1200);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-3xl" />
      </div>

      <Link href="/" className="flex items-center gap-2.5 font-extrabold text-xl mb-10 group">
        <BrandMark size={36} />
        <span className="text-ink">UMAI</span>
      </Link>

      <div className="w-full max-w-[380px]">
        <div className="bg-surface border border-line/80 rounded-2xl p-8 shadow-2xl shadow-black/30">
          <div className="text-center mb-6">
            <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
              <KeyRound size={22} className="text-brand" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Yeni şifre belirle</h1>
          </div>

          {checking ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted leading-relaxed">
                Bu bağlantı geçersiz veya süresi dolmuş. Giriş ekranından
                &quot;Şifremi unuttum&quot; ile yeni bir bağlantı iste.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-branddim text-[#111110] font-semibold py-3 px-5 rounded-xl transition-colors text-sm"
              >
                Giriş sayfasına dön
              </Link>
            </div>
          ) : success ? (
            <p className="text-center text-sm text-green-400">
              Şifren güncellendi — yönlendiriliyorsun…
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Yeni şifre</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    autoFocus
                    minLength={8}
                    className="w-full bg-bgsoft border border-line focus:border-brand rounded-xl pl-10 pr-11 py-3 text-sm outline-none transition-colors placeholder:text-muted/35"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Şifreyi gizle" : "Şifreyi göster"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Yeni şifre (tekrar)</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full bg-bgsoft border border-line focus:border-brand rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/35"
                  />
                </div>
              </div>

              {error && <div className="px-4 py-3 rounded-xl bg-red/8 border border-red/25 text-red text-sm">{error}</div>}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-50 disabled:cursor-not-allowed text-[#111110] font-semibold py-3 rounded-xl transition-colors text-sm mt-1"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Şifreyi Güncelle <ArrowRight size={15} /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
