"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [glLoading, setGlLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = "E-posta gerekli";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Geçersiz e-posta";
    if (!password) errs.password = "Şifre gerekli";
    else if (password.length < 8) errs.password = "En az 8 karakter";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const ATTEMPTS_KEY = "craftai_login_attempts";
  const readAttempts = (): { count: number; lockUntil: number } => {
    if (typeof window === "undefined") return { count: 0, lockUntil: 0 };
    try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "") ?? { count: 0, lockUntil: 0 }; }
    catch { return { count: 0, lockUntil: 0 }; }
  };
  const writeAttempts = (a: { count: number; lockUntil: number }) => {
    if (typeof window !== "undefined") localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
  };

  const submit = async () => {
    if (!validate()) return;
    setError(""); setSuccess("");

    if (mode === "login") {
      const attempts = readAttempts();
      const now = Date.now();
      if (attempts.lockUntil > now) {
        const secs = Math.ceil((attempts.lockUntil - now) / 1000);
        setError(`Çok fazla başarısız deneme. ${secs} saniye bekle.`);
        return;
      }
    }

    setLoading(true);
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }

    if (mode === "signup") {
      const { error: err } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (err) { setError(err.message); return; }
      setSuccess("Hesap oluşturuldu! E-postanı kontrol et, onay bağlantısı gönderildi.");
      return;
    }

    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      const attempts = readAttempts();
      const now = Date.now();
      const nextCount = attempts.count + 1;
      const lockUntil = nextCount >= 5 ? now + 60_000 : 0;
      writeAttempts({ count: nextCount, lockUntil });
      setError(lockUntil > 0 ? "Çok fazla başarısız deneme. 60 saniye bekle." : "E-posta veya şifre hatalı.");
      return;
    }
    writeAttempts({ count: 0, lockUntil: 0 });
    router.replace("/app");
    router.refresh();
  };

  const signInWithGitLab = async () => {
    setGlLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setGlLoading(false); return; }
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: "gitlab",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); setGlLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-3xl" />
      </div>

      <Link href="/" className="flex items-center gap-2.5 font-extrabold text-xl mb-10 group">
        <span className="w-9 h-9 rounded-xl brand-gradient grid place-items-center text-white shadow-lg shadow-brand/25 group-hover:shadow-brand/40 transition-shadow">◆</span>
        craft<span className="brand-text">.ai</span>
      </Link>

      <div className="w-full max-w-[380px]">
        <div className="bg-surface border border-line/80 rounded-2xl p-8 shadow-2xl shadow-black/30">
          <div className="text-center mb-6">
            <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
              <KeyRound size={22} className="text-brand" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {mode === "login" ? "Hoş geldin" : "Hesap oluştur"}
            </h1>
            <p className="text-muted text-sm mt-1.5">
              {mode === "login" ? "Hesabına giriş yap" : "Ücretsiz hesap aç"}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-line bg-bgsoft p-1 mb-5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setSuccess(""); setFieldErrors({}); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mode === m ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
              >
                {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted/80 uppercase tracking-wider">E-posta</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="ornek@email.com"
                  autoFocus
                  autoComplete="email"
                  className={`w-full bg-bgsoft border rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/35 ${fieldErrors.email ? "border-red/60 focus:border-red" : "border-line focus:border-brand"}`}
                />
              </div>
              {fieldErrors.email && <p className="text-red text-xs px-1">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted/80 uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={8}
                  className={`w-full bg-bgsoft border rounded-xl pl-10 pr-11 py-3 text-sm outline-none transition-colors placeholder:text-muted/35 ${fieldErrors.password ? "border-red/60 focus:border-red" : "border-line focus:border-brand"}`}
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted transition-colors" tabIndex={-1}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red text-xs px-1">{fieldErrors.password}</p>}
            </div>

            {error && <div className="px-4 py-3 rounded-xl bg-red/8 border border-red/25 text-red text-sm">{error}</div>}
            {success && <div className="px-4 py-3 rounded-xl bg-green-500/8 border border-green-500/25 text-green-400 text-sm">{success}</div>}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-1"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>{mode === "login" ? "Giriş Yap" : "Hesap Oluştur"} <ArrowRight size={15} /></>}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-line/60" />
              <span className="text-xs text-muted/50">veya</span>
              <div className="flex-1 h-px bg-line/60" />
            </div>

            {/* GitLab OAuth */}
            <button
              onClick={signInWithGitLab}
              disabled={glLoading}
              className="w-full flex items-center justify-center gap-2.5 border border-line bg-bgsoft hover:border-brand/60 hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {glLoading ? <Loader2 size={15} className="animate-spin" /> : (
                <>
                  <svg viewBox="0 0 25 24" width="16" height="16" fill="currentColor" className="text-orange-500">
                    <path d="M24.507 9.5l-.034-.09L21.082.562a.862.862 0 00-1.665.853l2.01 6.197H3.564L5.574 1.41a.862.862 0 10-1.664-.852L.494 9.411.46 9.5a6.037 6.037 0 002.008 6.97l.012.01.032.02 4.97 3.723 2.463 1.866 1.498 1.135a.998.998 0 001.206 0l1.498-1.135 2.463-1.866 5.002-3.743.014-.01A6.038 6.038 0 0024.507 9.5z" />
                  </svg>
                  GitLab ile Giriş Yap
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted/50 mt-5 leading-relaxed">
          Devam ederek{" "}
          <Link href="/terms" className="hover:text-brand transition-colors">Kullanım Şartları</Link>{" "}
          ve{" "}
          <Link href="/privacy" className="hover:text-brand transition-colors">Gizlilik Politikası</Link>
          &apos;nı kabul edersin.
        </p>
      </div>
    </div>
  );
}
