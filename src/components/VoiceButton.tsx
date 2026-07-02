"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

interface VoiceButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  lang?: string;
}

function getSpeechCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceButton({ onTranscript, lang = "tr-TR" }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SR | null>(null);
  /* SpeechRecognition yalnızca tarayıcıda var; tespiti mount sonrasına ertele ki
     ilk istemci render'ı sunucuyla (buton yok) eşleşsin → hidrasyon uyumsuzluğu olmaz. */
  const [mounted, setMounted] = useState(false);
  /* setState'i efekt gövdesinde DOĞRUDAN çağırmak yerine bir tık ertele
     (proje lint kuralı: set-state-in-effect). Davranış aynı: mount sonrası true. */
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);
  const Ctor = mounted ? getSpeechCtor() : null;
  const supported = !!Ctor;

  /* track latest callback without re-creating recognition */
  const cbRef = useRef(onTranscript);
  useEffect(() => { cbRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (text) cbRef.current(text, res.isFinal);
      }
    };
    r.onerror = (e: any) => {
      setError(String(e?.error || "speech error"));
      setListening(false);
    };
    r.onend = () => setListening(false);
    ref.current = r;
    return () => {
      try { r.stop(); } catch { /* ignore */ }
      ref.current = null;
    };
  }, [Ctor, lang]);

  const toggle = () => {
    if (!ref.current) return;
    setError(null);
    if (listening) {
      try { ref.current.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      try {
        ref.current.start();
        setListening(true);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      title={
        error ? `Hata: ${error}` :
        listening ? "Dinlemeyi durdur" :
        "Sesli dikte (Tarayıcı izni gerekebilir)"
      }
      className={`shrink-0 w-9 h-9 rounded-xl grid place-items-center transition-all ${
        listening
          ? "bg-red/15 text-red ring-2 ring-red/40 animate-pulse"
          : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}
