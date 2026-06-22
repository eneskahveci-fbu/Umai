"use client";

import { useMemo } from "react";
import { BarChart3, Coins, Cpu, MessageSquare } from "lucide-react";
import { useStore } from "@/lib/store";
import { calculateCost, formatCost, getModelPrice } from "@/lib/pricing";

/* Kullanım panosu — sohbet/mesaj/token/maliyet özetleri + son 7 gün grafiği.
   Tüm veriler istemcide (chats) toplanır; ek sunucu/maliyet yok. */
export function AnalyticsSettings() {
  const chats = useStore((s) => s.chats);
  const config = useStore((s) => s.config);

  const stats = useMemo(() => {
    const real = chats.filter((c) => !c.incognito);
    let msgs = 0, tin = 0, tout = 0;
    for (const c of real) {
      msgs += c.messages.length;
      tin += c.totalInTokens ?? 0;
      tout += c.totalOutTokens ?? 0;
    }
    // Son 7 gün token kovalar
    const days: { label: string; tokens: number }[] = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const start = d.getTime(); const end = start + 86400000;
      let t = 0;
      for (const c of real) {
        if (c.created_at >= start && c.created_at < end) t += (c.totalInTokens ?? 0) + (c.totalOutTokens ?? 0);
      }
      days.push({ label: d.toLocaleDateString("tr-TR", { weekday: "short" }), tokens: t });
    }
    const maxDay = Math.max(1, ...days.map((x) => x.tokens));
    const top = [...real]
      .map((c) => ({ title: c.title, tokens: (c.totalInTokens ?? 0) + (c.totalOutTokens ?? 0) }))
      .filter((x) => x.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);
    return { count: real.length, msgs, tin, tout, total: tin + tout, days, maxDay, top };
  }, [chats]);

  const active = config.models.find((m) => m.id === config.activeModelId);
  const hasPrice = active ? getModelPrice(active.model) !== null : false;
  const cost = active ? calculateCost(active.model, stats.tin, stats.tout) : null;

  const cards = [
    { icon: MessageSquare, label: "Sohbet", value: stats.count.toLocaleString("tr-TR") },
    { icon: BarChart3, label: "Mesaj", value: stats.msgs.toLocaleString("tr-TR") },
    { icon: Cpu, label: "Token", value: stats.total.toLocaleString("tr-TR") },
    { icon: Coins, label: "Tahmini maliyet", value: cost !== null && hasPrice ? formatCost(cost) : "—" },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><BarChart3 size={16} className="text-brand" /> Kullanım</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">Tüm sohbetlerinin özeti — yalnızca senin tarayıcında hesaplanır. Gizli sohbetler dahil değildir.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map(({ icon: I, label, value }) => (
          <div key={label} className="premium-card rounded-xl p-3 text-center">
            <I size={15} className="text-brand/70 mx-auto mb-1" />
            <div className="text-lg font-bold leading-none truncate">{value}</div>
            <div className="text-[10px] text-muted/55 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-2">Son 7 gün (token)</div>
        <div className="premium-card rounded-xl p-3 flex items-end justify-between gap-1.5 h-28">
          {stats.days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full rounded-t bg-brand/70" style={{ height: `${Math.max(2, (d.tokens / stats.maxDay) * 80)}px` }} title={`${d.tokens.toLocaleString("tr-TR")} token`} />
              <span className="text-[9px] text-muted/50 truncate">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted/45 mt-1">Giriş: {stats.tin.toLocaleString("tr-TR")} · Çıkış: {stats.tout.toLocaleString("tr-TR")} token</div>
      </div>

      {stats.top.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">En çok token kullanan sohbetler</div>
          <div className="space-y-1">
            {stats.top.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted/40 font-mono w-4 shrink-0">{i + 1}.</span>
                <span className="flex-1 truncate text-muted/80">{t.title}</span>
                <span className="font-mono text-[11px] text-muted/60 shrink-0">{t.tokens.toLocaleString("tr-TR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted/45 leading-relaxed">Maliyet, aktif modelin fiyatına göre kaba tahmindir (ücretsiz modeller 0). Gerçek fatura sağlayıcına aittir.</p>
    </section>
  );
}
