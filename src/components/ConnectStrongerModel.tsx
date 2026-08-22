"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ExternalLink, KeyRound, Loader2, X, Zap } from "lucide-react";
import { FREE_KEY_OPTIONS, type FreeKeyOption } from "@/lib/constants";
import {
  checkKey,
  connectModel,
  isBlockingProblem,
  normalizeKey,
  shouldOfferStrongerModel,
} from "@/lib/connectModel";
import { useStore } from "@/lib/store";

const DISMISS_KEY = "craftai_model_bridge_dismissed";

/* "Daha güçlü model bağla" köprüsü.
   ────────────────────────────────────────────────────────────────────────────
   NEDEN VAR: Anahtarsız kullanıcı zayıf varsayılan modelle karşılaşıyor ve
   ürünün en güçlü kozunu — kendi ücretsiz anahtarıyla çok daha güçlü bir model
   çalıştırmayı — Ayarlar'a girmeden HİÇ görmüyordu. Onboarding'de bu yalnız son
   adımda, "İleri düzey (opsiyonel)" başlığıyla geçiyordu.

   NE DEĞİL: Bir DUVAR değil. prompt.md, ücretsiz deneyimin arkasına yeni engel
   konmasını açıkça yasaklıyor — bu yüzden hiçbir şeyi kilitlemez, kapatılabilir,
   ve kullanıcı anahtarsız varsayılanla sonsuza kadar devam edebilir. Kapalıyken
   tek satırlık sessiz bir davet, yalnız açınca yer kaplar. */
export function ConnectStrongerModel() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FreeKeyOption | null>(null);
  const [key, setKey] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (dismissed || !shouldOfferStrongerModel(config)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const submit = () => {
    if (!picked) return;
    const clean = normalizeKey(key);
    const check = checkKey(clean, picked);
    /* Ön ek uyuşmazlığı ENGEL DEĞİL, yalnız uyarı: sağlayıcılar ön eklerini
       zamanla değiştiriyor ve geçerli bir anahtarı reddetmek, uyarmaktan çok
       daha kötü bir hata. Gerçekten engelleyici olanlar (boş/kısa/URL) durur. */
    if (!check.ok && isBlockingProblem(check, clean, picked)) { setWarn(check.reason); return; }
    setWarn(!check.ok ? check.reason : null);
    setBusy(true);
    saveConfig(connectModel(config, picked, clean));
    addToast(`${picked.name} bağlandı ve aktif model yapıldı ✓`, "success");
    setBusy(false);
  };

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-1.5">
        <button
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-1.5 text-xs text-muted/70 hover:text-ink transition-colors"
        >
          <Zap size={13} className="text-brand/70" />
          Daha güçlü bir model bağla
          <span className="text-muted/45">— ücretsiz, ~30 saniye</span>
          <ArrowUpRight size={12} className="text-muted/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
        <button
          onClick={dismiss}
          title="Bir daha gösterme"
          aria-label="Bir daha gösterme"
          className="text-muted/30 hover:text-muted/70 p-1 rounded transition-colors"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-4 w-full max-w-md rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-4 text-left animate-fade-in shrink-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Zap size={14} className="text-brand" />
            Daha güçlü bir model bağla
          </div>
          <p className="text-[12.5px] text-muted/70 leading-relaxed mt-1">
            Aşağıdakilerin hepsi <strong className="text-ink/80">ücretsiz</strong> ve kredi kartı istemiyor.
            Anahtarın yalnızca <strong className="text-ink/80">senin tarayıcında</strong> saklanır.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Kapat"
          className="text-muted/40 hover:text-ink p-1 rounded transition-colors shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      {!picked ? (
        <div className="flex flex-col gap-1">
          {FREE_KEY_OPTIONS.map((o) => (
            <button
              key={o.provider}
              onClick={() => { setPicked(o); setWarn(null); }}
              className="flex items-start gap-2.5 text-left px-2.5 py-2 rounded-xl hover:bg-bgsoft transition-colors"
            >
              <KeyRound size={13} className="text-brand/70 mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">{o.name}</span>
                <span className="block text-[11.5px] text-muted/65 leading-snug">{o.why}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">{picked.name}</span>
            <button
              onClick={() => { setPicked(null); setKey(""); setWarn(null); }}
              className="text-[11px] text-muted/60 hover:text-ink transition-colors"
            >
              başka seç
            </button>
          </div>

          <a
            href={picked.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-brand hover:underline w-fit"
          >
            1. Ücretsiz anahtarı al
            <ExternalLink size={11} />
          </a>

          <label className="text-[12.5px] text-muted/70">
            2. Buraya yapıştır
            <input
              autoFocus
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setWarn(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder={`${picked.keyPrefix}…`}
              className="mt-1 w-full bg-bgsoft border border-line rounded-xl px-3 py-2 text-[13px] font-mono text-ink outline-none focus:border-brand/50 transition-colors"
            />
          </label>

          {warn && <p className="text-[11.5px] text-yellow leading-snug">{warn}</p>}

          <button
            onClick={submit}
            disabled={busy || !key.trim()}
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-xl bg-brand hover:bg-branddim text-[#111110] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Bağla ve kullan
          </button>
        </div>
      )}
    </div>
  );
}
