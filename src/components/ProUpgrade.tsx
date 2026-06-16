"use client";

import { useState } from "react";
import { Crown, ExternalLink, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabaseConfigured } from "@/lib/supabase/client";

/* Para kazanma akışı (Stripe). BYOK her zaman ÜCRETSİZ; bu yalnızca Pro ek
   özelliklerini (hazır kullanım + sınırsız bulut senkron) açar. Stripe/Supabase
   yapılandırılmamışsa bileşen gizlenir → uygulama eskisi gibi çalışır. */
export function ProUpgrade() {
  const userId = useStore((s) => s.userId);
  const plan = useStore((s) => s.plan);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const addToast = useStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);

  if (!supabaseConfigured) return null; // ödeme/hesap katmanı kapalı

  const go = async (endpoint: "checkout" | "portal") => {
    if (!userId) {
      addToast("Önce giriş yap.", "info");
      setSettingsOpen(false);
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Bir hata oluştu.");
      window.location.href = data.url;
    } catch (e) {
      addToast((e as Error).message, "error");
      setLoading(false);
    }
  };

  if (plan === "pro") {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Crown size={15} /> Pro üyesin
        </div>
        <p className="text-[11px] text-muted/70 mt-1 mb-2">Bulut senkron + hazır kullanım açık. Teşekkürler!</p>
        <button
          onClick={() => go("portal")}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-line hover:border-brand/50 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
          Aboneliği Yönet
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand/30 bg-gradient-to-b from-brand/10 to-transparent p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Crown size={15} className="text-brand" /> Pro&apos;ya Geç
      </div>
      <p className="text-[11px] text-muted/70 mt-1 mb-2 leading-relaxed">
        Kendi anahtarın (BYOK) hep ücretsiz. Pro: hazır kullanım (anahtarsız) + sınırsız bulut senkron.
      </p>
      <button
        onClick={() => go("checkout")}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-brand text-[#111110] hover:bg-branddim transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Crown size={13} />}
        Pro&apos;ya Geç
      </button>
    </div>
  );
}
