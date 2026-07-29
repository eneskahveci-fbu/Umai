"use client";

import { useMemo } from "react";
import { AlertTriangle, BarChart3, Coins, Cpu, MessageSquare } from "lucide-react";
import { useStore } from "@/lib/store";
import { calculateCost, formatCost, getModelPrice } from "@/lib/pricing";
import { useCountUp } from "@/lib/useCountUp";
import { calcBudgetStatus } from "@/lib/budget";

/* Kullanım panosu — sohbet/mesaj/token/maliyet özetleri + son 7 gün grafiği.
   Tüm veriler istemcide (chats) toplanır; ek sunucu/maliyet yok. */
export function AnalyticsSettings() {
  const chats = useStore((s) => s.chats);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);

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
  const budget = calcBudgetStatus(chats, active?.model, config.monthlyBudgetUsd);

  /* Sayılar bir kareden diğerine ZIPLAMAK yerine kısaca sayarak değişir —
     değişimi çevresel görüşte bile yakalatır. İlk gösterimde ve "hareketi
     azalt" tercihinde doğrudan son değere atlar (bkz. useCountUp). */
  const countAnim = useCountUp(stats.count);
  const msgsAnim = useCountUp(stats.msgs);
  const totalAnim = useCountUp(stats.total);
  const costAnim = useCountUp(cost ?? 0, { minDelta: 0 });

  const cards = [
    { icon: MessageSquare, label: "Sohbet", value: Math.round(countAnim).toLocaleString("tr-TR") },
    { icon: BarChart3, label: "Mesaj", value: Math.round(msgsAnim).toLocaleString("tr-TR") },
    { icon: Cpu, label: "Token", value: Math.round(totalAnim).toLocaleString("tr-TR") },
    { icon: Coins, label: "Tahmini maliyet", value: cost !== null && hasPrice ? formatCost(costAnim) : "—" },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><BarChart3 size={16} className="text-brand" /> Kullanım</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">Tüm sohbetlerinin özeti — yalnızca senin tarayıcında hesaplanır. Gizli sohbetler dahil değildir.</p>
      </div>

      <div className="stagger grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map(({ icon: I, label, value }, i) => (
          <div key={label} className="premium-card rounded-xl p-3 text-center" style={{ "--i": i } as React.CSSProperties}>
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

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-2">Aylık bütçe uyarısı</div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={config.monthlyBudgetUsd ?? ""}
            onChange={(e) => saveConfig({ ...config, monthlyBudgetUsd: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Belirtilmedi"
            aria-label="Aylık bütçe (USD)"
            className="w-28 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50"
          />
          <span className="text-xs text-muted/60">USD/ay — aşılırsa uyarı gösterilir</span>
        </div>
        {budget && (
          <div className="premium-card rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={budget.level === "over" ? "text-red font-semibold" : budget.level === "warning" ? "text-yellow font-semibold" : "text-muted"}>
                {formatCost(budget.spentUsd)} / {formatCost(budget.budgetUsd)} bu ay
              </span>
              <span className="tabular-nums text-muted/60">%{Math.round(budget.ratio * 100)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-bgsoft overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] ${budget.level === "over" ? "bg-red" : budget.level === "warning" ? "bg-yellow" : "bg-brand"}`}
                style={{ width: `${Math.min(100, budget.ratio * 100)}%` }}
              />
            </div>
            {budget.level !== "ok" && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted/70">
                <AlertTriangle size={11} className={budget.level === "over" ? "text-red" : "text-yellow"} />
                {budget.level === "over" ? "Bu ay belirlediğin bütçeyi aştın." : "Bu ay bütçenin %80'ine yaklaştın."}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted/45 leading-relaxed">Maliyet, aktif modelin fiyatına göre kaba tahmindir (ücretsiz modeller 0). Gerçek fatura sağlayıcına aittir.</p>
    </section>
  );
}
