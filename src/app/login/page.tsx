"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, KeyRound, Loader2, Mail, Phone, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "choose" | "email" | "email-code" | "phone" | "phone-code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("choose");
    setCode("");
    setError("");
  };

  const signInOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }
    const { error: err } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  const sendEmailCode = async () => {
    const e = email.trim();
    if (!e) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }
    const { error: err } = await sb.auth.signInWithOtp({
      email: e,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStep("email-code");
  };

  const sendPhoneCode = async () => {
    const p = phone.trim();
    if (!p) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) { setError("Kimlik doğrulama yapılandırılmamış."); setLoading(false); return; }
    const { error: err } = await sb.auth.signInWithOtp({
      phone: p,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStep("phone-code");
  };

  const verifyEmailCode = async () => {
    const token = code.trim();
    if (token.length < 4) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) return;
    const { error: err } = await sb.auth.verifyOtp({ email, token, type: "email" });
    setLoading(false);
    if (err) { setError("Kod hatalı veya süresi dolmuş. Tekrar dene."); return; }
    router.push("/app");
  };

  const verifyPhoneCode = async () => {
    const token = code.trim();
    if (token.length < 4) return;
    setLoading(true);
    setError("");
    const sb = createClient();
    if (!sb) return;
    const { error: err } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
    setLoading(false);
    if (err) { setError("Kod hatalı veya süresi dolmuş. Tekrar dene."); return; }
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand/8 rounded-full blur-3xl" />
      </div>

      <Link href="/" className="flex items-center gap-2.5 font-extrabold text-xl mb-12 group">
        <span className="w-9 h-9 rounded-xl brand-gradient grid place-items-center text-white shadow-lg shadow-brand/25 group-hover:shadow-brand/40 transition-shadow">
          ◆
        </span>
        craft<span className="brand-text">.ai</span>
      </Link>

      <div className="w-full max-w-[400px]">
        <div className="bg-surface border border-line/80 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {step === "choose" && (
            <ChooseStep
              onGoogle={() => signInOAuth("google")}
              onApple={() => signInOAuth("apple")}
              onEmail={() => { setError(""); setStep("email"); }}
              onPhone={() => { setError(""); setStep("phone"); }}
              loading={loading}
              error={error}
            />
          )}
          {step === "email" && (
            <EmailStep
              email={email}
              setEmail={setEmail}
              onSubmit={sendEmailCode}
              onBack={reset}
              loading={loading}
              error={error}
            />
          )}
          {step === "email-code" && (
            <CodeStep
              label={email}
              code={code}
              setCode={setCode}
              onSubmit={verifyEmailCode}
              onBack={() => { setStep("email"); setCode(""); setError(""); }}
              loading={loading}
              error={error}
            />
          )}
          {step === "phone" && (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              onSubmit={sendPhoneCode}
              onBack={reset}
              loading={loading}
              error={error}
            />
          )}
          {step === "phone-code" && (
            <CodeStep
              label={phone}
              code={code}
              setCode={setCode}
              onSubmit={verifyPhoneCode}
              onBack={() => { setStep("phone"); setCode(""); setError(""); }}
              loading={loading}
              error={error}
            />
          )}
        </div>

        <p className="text-center text-xs text-muted/60 mt-6 leading-relaxed">
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

/* ─── Choose Method ─── */

function ChooseStep({
  onGoogle, onApple, onEmail, onPhone, loading, error,
}: {
  onGoogle: () => void; onApple: () => void; onEmail: () => void; onPhone: () => void;
  loading: boolean; error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <KeyRound size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Giriş yap / Kayıt ol</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          Devam etmek için bir yöntem seç
        </p>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onGoogle}
          disabled={loading}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:border-line/80 hover:bg-bgsoft/60 text-sm font-medium transition-colors disabled:opacity-40"
        >
          <GoogleIcon />
          Google ile devam et
          {loading && <Loader2 size={14} className="ml-auto animate-spin text-muted" />}
        </button>

        <button
          onClick={onApple}
          disabled={loading}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:border-line/80 hover:bg-bgsoft/60 text-sm font-medium transition-colors disabled:opacity-40"
        >
          <AppleIcon />
          Apple ile devam et
        </button>

        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-line/60" />
          <span className="text-[11px] text-muted/60 uppercase tracking-wider font-medium">veya</span>
          <div className="flex-1 h-px bg-line/60" />
        </div>

        <button
          onClick={onEmail}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:border-brand/40 hover:bg-brand/5 text-sm font-medium transition-colors"
        >
          <Mail size={18} className="text-muted" />
          E-posta ile devam et
        </button>

        <button
          onClick={onPhone}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:border-brand/40 hover:bg-brand/5 text-sm font-medium transition-colors"
        >
          <Phone size={18} className="text-muted" />
          Telefon ile devam et
        </button>
      </div>

      {error && <p className="text-red text-xs text-center mt-3">{error}</p>}
    </>
  );
}

/* ─── Email Step ─── */

function EmailStep({
  email, setEmail, onSubmit, onBack, loading, error,
}: {
  email: string; setEmail: (v: string) => void; onSubmit: () => void; onBack: () => void;
  loading: boolean; error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <Mail size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">E-posta ile giriş</h1>
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

        {error && <p className="text-red text-xs px-1">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={!email.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <>Kod Gönder <ArrowRight size={15} /></>}
        </button>

        <button onClick={onBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink py-2 transition-colors">
          <ArrowLeft size={14} /> Geri dön
        </button>
      </div>
    </>
  );
}

/* ─── Phone Step ─── */

function PhoneStep({
  phone, setPhone, onSubmit, onBack, loading, error,
}: {
  phone: string; setPhone: (v: string) => void; onSubmit: () => void; onBack: () => void;
  loading: boolean; error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <Phone size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Telefon ile giriş</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          Telefonuna 6 haneli doğrulama kodu göndereceğiz
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="+90 5XX XXX XX XX"
          autoFocus
          autoComplete="tel"
          className="w-full bg-bgsoft border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-brand transition-colors placeholder:text-muted/40"
        />

        {error && <p className="text-red text-xs px-1">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={!phone.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <>Kod Gönder <ArrowRight size={15} /></>}
        </button>

        <button onClick={onBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink py-2 transition-colors">
          <ArrowLeft size={14} /> Geri dön
        </button>
      </div>
    </>
  );
}

/* ─── Code Verification (shared by email & phone) ─── */

function CodeStep({
  label, code, setCode, onSubmit, onBack, loading, error,
}: {
  label: string; code: string; setCode: (v: string) => void;
  onSubmit: () => void; onBack: () => void; loading: boolean; error: string;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-[52px] h-[52px] mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center">
          <KeyRound size={24} className="text-brand" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Kodu gir</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          <span className="text-ink font-medium">{label}</span> adresine
          <br />6 haneli kod gönderdik
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="000000"
          autoFocus
          autoComplete="one-time-code"
          className="w-full bg-bgsoft border border-line rounded-xl px-4 py-3.5 text-3xl font-mono tracking-[0.6em] text-center outline-none focus:border-brand transition-colors placeholder:text-muted/25 placeholder:tracking-widest placeholder:text-xl"
        />

        {error && <p className="text-red text-xs text-center px-1">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={code.length < 4 || loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-branddim disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Doğrula ve Giriş Yap"}
        </button>

        <button onClick={onBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink py-2 transition-colors">
          <ArrowLeft size={14} /> Geri dön
        </button>
      </div>
    </>
  );
}

/* ─── SVG Icons ─── */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
