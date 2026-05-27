"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, KeyRound, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Metadata } from "next";

// Not: metadata sadece Server Component'te çalışır.
// Bu sayfa client olduğu için title layout.tsx'ten gelir.

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    const e = email.trim();
    if (!e) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) {
      setError("Kimlik doğrulama yapılandırılmamış.");
      setLoading(false);
      return;
    }
    const { error: err } = await sb.auth.signInWithOtp({
      email: e,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("code");
  };

  const verifyCode = async () => {
    const token = code.trim();
    if (token.length < 4) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) return;
    const { error: err } = await sb.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setLoading(false);
    if (err) {
      setError("Kod hatalı veya süresi dolmuş. Tekrar dene.");
      return;
    }
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Arka plan parıltısı */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand/8 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2.5 font-extrabold text-xl mb-12 group"
      >
        <span className="w-9 h-9 rounded-xl brand-gradient grid place-items-center text-white shadow-lg shadow-brand/25 group-hover:shadow-brand/40 transition-shadow">
          ◆
        </span>
        craft<span className="brand-text">.ai</span>
      </Link>

      {/* Kart */}
      <div className="w-full max-w-[380px]">
        <div className="bg-surface border border-line/80 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {step === "email" ? (
            <EmailStep
              email={email}
              setEmail={setEmail}
              onSubmit={sendCode}
              loading={loading}
              error={error}
            />
          ) : (
            <CodeStep
              email={email}
              code={code}
              setCode={setCode}
              onSubmit={verifyCode}
              onBack={() => { setStep("email"); setCode(""); setError(""); }}
              loading={loading}
              error={error}
            />
          )}
        </div>

        <p className="text-center text-xs text-muted/60 mt-6 leading-relaxed">
          Devam ederek{" "}
          <Link href="/terms" className="hover:text-brand transition-colors">
            Kullanım Şartları
          </Link>{" "}
          ve{" "}
          <Link href="/privacy" className="hover:text-brand transition-colors">
            Gizlilik Politikası
          </Link>
          &apos;nı kabul edersin.
        </p>
      </div>
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  onSubmit,
  loading,
  error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-13 h-13 mx-auto mb-4 w-[52px] h-[52px] rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <Mail size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Giriş yap / Kayıt ol</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          E-postana 6 haneli doğrulama kodu göndereceğiz
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="ornek@email.com"
          autoFocus
          autoComplete="email"
          className="w-full bg-bgsoft border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-brand transition-colors placeholder:text-muted/40"
        />

        {error && (
          <p className="text-red text-xs px-1">{error}</p>
        )}

        <button
          onClick={onSubmit}
          disabled={!email.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Kod Gönder <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </>
  );
}

function CodeStep({
  email,
  code,
  setCode,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  email: string;
  code: string;
  setCode: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <KeyRound size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Kodu gir</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          <span className="text-ink font-medium">{email}</span> adresine
          <br />
          6 haneli kod gönderdik
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="000000"
          autoFocus
          autoComplete="one-time-code"
          className="w-full bg-bgsoft border border-line rounded-xl px-4 py-3.5 text-3xl font-mono tracking-[0.6em] text-center outline-none focus:border-brand transition-colors placeholder:text-muted/25 placeholder:tracking-widest placeholder:text-xl"
        />

        {error && (
          <p className="text-red text-xs text-center px-1">{error}</p>
        )}

        <button
          onClick={onSubmit}
          disabled={code.length < 4 || loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Doğrula ve Giriş Yap"
          )}
        </button>

        <button
          onClick={onBack}
          className="w-full text-sm text-muted hover:text-ink text-center py-2 transition-colors"
        >
          ← Farklı e-posta kullan
        </button>
      </div>
    </>
  );
}
