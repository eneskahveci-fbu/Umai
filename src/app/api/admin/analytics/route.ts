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

  return NextResponse.json({
    windowDays,
    totalEvents: rows?.length ?? 0,
    activeUsers: activeUsers.size,
    byEvent,
    bySurface,
  });
}
