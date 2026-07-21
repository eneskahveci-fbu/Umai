import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isAdminEmail } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Toplu ürün analitiği (admin-only). Servis anahtarı YALNIZCA sunucuda
   kullanılır. Kullanıcı kendi erişim anahtarıyla (Authorization: Bearer)
   doğrulanır VE e-postası admin listesinde olmalı (bkz. src/lib/admin.ts).
   SUPABASE_SERVICE_ROLE_KEY env'i tanımlı değilse 501 ile nazikçe reddeder. */
export async function GET(request: Request) {
  const __rl = rateLimit(request, "admin-analytics", 20, 60_000);
  if (__rl) return __rl;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Analitik sunucuda yapılandırılmamış. (SUPABASE_SERVICE_ROLE_KEY env'i eksik.)" },
      { status: 501 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
  if (!isAdminEmail(data.user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const windowDays = 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error: qErr } = await admin
    .from("analytics_events")
    .select("event_name, surface, user_id, created_at")
    .gte("created_at", since)
    .limit(5000);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const byEvent: Record<string, number> = {};
  const bySurface: Record<string, number> = {};
  const activeUsers = new Set<string>();
  for (const r of rows ?? []) {
    byEvent[r.event_name] = (byEvent[r.event_name] ?? 0) + 1;
    if (r.surface) bySurface[r.surface] = (bySurface[r.surface] ?? 0) + 1;
    if (r.user_id) activeUsers.add(r.user_id);
  }

  /* Gün-üstü-gün (DoD) dönüş oranı — prompt.md Hamle 5: "kaç kullanıcı YARIN
     da geri geldi" sorusuna somut bir cevap. Takvim günlerini (boş günler
     dahil) baştan üretip her gün için bir SONRAKİ takvim gününde de aktif
     olan kullanıcı oranını hesaplar. Ayrı bir sorgu gerektirmez — yukarıdaki
     `rows` üzerinden türetilir. */
  const dayKey = (iso: string) => iso.slice(0, 10);
  const today = new Date();
  const calendarDays: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    calendarDays.push(dayKey(new Date(today.getTime() - i * 86_400_000).toISOString()));
  }
  const activeByDay: Record<string, Set<string>> = {};
  for (const day of calendarDays) activeByDay[day] = new Set();
  for (const r of rows ?? []) {
    if (!r.user_id) continue;
    const day = dayKey(r.created_at);
    activeByDay[day]?.add(r.user_id);
  }
  const retention = calendarDays.map((day, i) => {
    const activeSet = activeByDay[day];
    const nextDay = calendarDays[i + 1];
    if (!nextDay || activeSet.size === 0) {
      return { day, activeUsers: activeSet.size, returnedNextDay: null as number | null, returnRatePct: null as number | null };
    }
    const nextSet = activeByDay[nextDay];
    let returned = 0;
    for (const uid of activeSet) if (nextSet.has(uid)) returned++;
    return { day, activeUsers: activeSet.size, returnedNextDay: returned, returnRatePct: Math.round((returned / activeSet.size) * 1000) / 10 };
  });
  const ratedDays = retention.filter((d) => d.returnRatePct !== null);
  const avgReturnRatePct = ratedDays.length
    ? Math.round((ratedDays.reduce((sum, d) => sum + (d.returnRatePct ?? 0), 0) / ratedDays.length) * 10) / 10
    : null;

  return NextResponse.json({
    windowDays,
    totalEvents: rows?.length ?? 0,
    activeUsers: activeUsers.size,
    byEvent,
    bySurface,
    retention,
    avgReturnRatePct,
  });
}
