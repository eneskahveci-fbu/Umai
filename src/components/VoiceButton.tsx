"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

/* Web Speech API'nin SpeechRecognition'ı hâlâ standart TS DOM lib'inde yok
   (tarayıcı desteği tutarsız, vendor-prefix'li) — kullanılan alanlarla sınırlı
   yerel bir tip burada tanımlanıyor, `any` yerine. */
interface SpeechRecognitionResultLike { 0: { transcript?: string }; isFinal: boolean }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionErrorEventLike { error?: string }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface VoiceButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  lang?: string;
  /** Stüdyo composer'ındaki bordürlü pil düğmelerle (ataç/model/vb.) görsel
      tutarlılık için — varsayılan (false) ana sohbetteki hayalet ikon stilini korur. */
  pill?: boolean;
}

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceButton({ onTranscript, lang = "tr-TR", pill = false }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);
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
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (text) cbRef.current(text, res.isFinal);
      }
    };
    r.onerror = (e) => {
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
      className={`shrink-0 ${pill ? "w-9 h-9 border border-line/70 bg-bgsoft/60 hover:border-brand/40" : "w-10 h-10 sm:w-9 sm:h-9"} rounded-xl grid place-items-center transition-all ${
        listening
          ? "bg-red/15 text-red ring-2 ring-red/40 animate-pulse"
          : "text-muted hover:text-ink hover:bg-bgsoft"
      }`}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}
