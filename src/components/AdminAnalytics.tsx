"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface RetentionDay {
  day: string;
  activeUsers: number;
  returnedNextDay: number | null;
  returnRatePct: number | null;
}

interface AdminAnalyticsData {
  windowDays: number;
  totalEvents: number;
  activeUsers: number;
  byEvent: Record<string, number>;
  bySurface: Record<string, number>;
  retention: RetentionDay[];
  avgReturnRatePct: number | null;
}

/* Admin-only TOPLU ürün analitiği — AnalyticsSettings.tsx'in KİŞİSEL
   (yerel sohbet geçmişinden hesaplanan) görünümünden ayrı: bu bileşen
   sunucudaki `analytics_events` tablosunu (bkz. supabase/schema.sql,
   /api/admin/analytics) admin e-postasına kilitli bir API üzerinden okur.
   Servis anahtarı sunucuda yoksa (501) ya da admin değilse (403) sessizce
   bilgilendirici bir not gösterir — sayfa çökmez. */
export function AdminAnalytics() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: AdminAnalyticsData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      if (!sb) { if (!cancelled) setState({ status: "error", message: "Kimlik doğrulama yapılandırılmamış." }); return; }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { if (!cancelled) setState({ status: "error", message: "Oturum bulunamadı." }); return; }
      try {
        const res = await fetch("/api/admin/analytics", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setState({ status: "error", message: json.error || `Hata (${res.status})` }); return; }
        setState({ status: "ok", data: json });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "bilinmeyen hata" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="space-y-3 pt-2 border-t border-line/60">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-2"><Users size={16} className="text-brand" /> Toplu Analitik (admin)</h4>
        <p className="text-xs text-muted/70 mt-1 leading-relaxed">
          Tüm kullanıcıların agregat kullanım özeti — hangi yüzey ne kadar kullanılıyor.
          Kişisel veriye erişilmez, yalnız sayımlar.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted/60 py-3">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs text-muted/60 py-2">{state.message}</p>
      )}

      {state.status === "ok" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="premium-card rounded-xl p-3 text-center">
              <BarChart3 size={15} className="text-brand/70 mx-auto mb-1" />
              <div className="text-lg font-bold leading-none">{state.data.totalEvents.toLocaleString("tr-TR")}</div>
              <div className="text-[10px] text-muted/55 mt-1">Olay (son {state.data.windowDays} gün)</div>
            </div>
            <div className="premium-card rounded-xl p-3 text-center">
              <Users size={15} className="text-brand/70 mx-auto mb-1" />
              <div className="text-lg font-bold leading-none">{state.data.activeUsers.toLocaleString("tr-TR")}</div>
              <div className="text-[10px] text-muted/55 mt-1">Aktif kullanıcı</div>
            </div>
            <div className="premium-card rounded-xl p-3 text-center">
              <RefreshCw size={15} className="text-brand/70 mx-auto mb-1" />
              <div className="text-lg font-bold leading-none">
                {state.data.avgReturnRatePct === null ? "—" : `%${state.data.avgReturnRatePct}`}
              </div>
              <div className="text-[10px] text-muted/55 mt-1">Ort. ertesi gün dönüş</div>
            </div>
          </div>

          {/* prompt.md Hamle 5: "kaç kullanıcı YARIN da geri geldi" — gün
              bazlı dönüş oranı, yeni özellik yerine bu soruya bakmayı
              alışkanlık hâline getirmek için. */}
          {state.data.retention.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Gün-üstü-gün dönüş (D+1)</div>
              <div className="space-y-1">
                {state.data.retention.map((d) => (
                  <div key={d.day} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-muted/80 font-mono">{d.day}</span>
                    <span className="text-muted/60 text-[11px]">{d.activeUsers} aktif</span>
                    <span className="font-mono text-[11px] w-14 text-right shrink-0 text-muted/70">
                      {d.returnRatePct === null ? "—" : `%${d.returnRatePct}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(state.data.bySurface).length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Yüzey dağılımı</div>
              <div className="space-y-1">
                {Object.entries(state.data.bySurface).sort((a, b) => b[1] - a[1]).map(([surface, count]) => (
                  <div key={surface} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-muted/80">{surface}</span>
                    <span className="font-mono text-[11px] text-muted/60 shrink-0">{count.toLocaleString("tr-TR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(state.data.byEvent).length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Olay türü dağılımı</div>
              <div className="space-y-1">
                {Object.entries(state.data.byEvent).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-muted/80">{name}</span>
                    <span className="font-mono text-[11px] text-muted/60 shrink-0">{count.toLocaleString("tr-TR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
