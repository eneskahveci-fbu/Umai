"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = "E-posta gerekli";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Geçersiz e-posta adresi";
    if (!password) errs.password = "Şifre gerekli";
    else if (password.length < 6) errs.password = "Şifre en az 6 karakter olmalı";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const signIn = async () => {
    if (!validate()) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) { setError("E-posta veya şifre hatalı. Lütfen tekrar dene."); return; }
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 font-extrabold text-xl mb-10 group">
        <span className="w-9 h-9 rounded-xl brand-gradient grid place-items-center text-white shadow-lg shadow-brand/25 group-hover:shadow-brand/40 transition-shadow">
          ◆
        </span>
        craft<span className="brand-text">.ai</span>
      </Link>

      <div className="w-full max-w-[380px]">
        <div className="bg-surface border border-line/80 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {/* Heading */}
          <div className="text-center mb-7">
            <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
              <KeyRound size={22} className="text-brand" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Hoş geldin</h1>
            <p className="text-muted text-sm mt-1.5 leading-relaxed">
              Hesabına giriş yap
            </p>
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted/80 uppercase tracking-wider">
                E-posta
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                  placeholder="ornek@email.com"
                  autoFocus
                  autoComplete="email"
                  className={`w-full bg-bgsoft border rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/35 ${
                    fieldErrors.email ? "border-red/60 focus:border-red" : "border-line focus:border-brand"
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-red text-xs px-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted/80 uppercase tracking-wider">
                Şifre
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full bg-bgsoft border rounded-xl pl-10 pr-11 py-3 text-sm outline-none transition-colors placeholder:text-muted/35 ${
                    fieldErrors.password ? "border-red/60 focus:border-red" : "border-line focus:border-brand"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red text-xs px-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Global error */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red/8 border border-red/25 text-red text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={signIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-1"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Giriş Yap <ArrowRight size={15} /></>
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
