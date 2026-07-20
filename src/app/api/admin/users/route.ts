import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isAdminEmail } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

/** Kayıtlı kullanıcı listesi (admin-only "Superadmin" paneli — kim hangi
   hesapla giriş yapmış). Servis anahtarı YALNIZCA sunucuda kullanılır.
   Kullanıcı kendi erişim anahtarıyla (Authorization: Bearer) doğrulanır VE
   e-postası admin listesinde olmalı (bkz. src/lib/admin.ts). Diğer admin
   uçlarıyla (analytics, account/delete) AYNI desen: SUPABASE_SERVICE_ROLE_KEY
   env'i yoksa 501 ile nazikçe reddeder. */
export async function GET(request: Request) {
  const __rl = rateLimit(request, "admin-users", 20, 60_000);
  if (__rl) return __rl;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Kullanıcı listesi sunucuda yapılandırılmamış. (SUPABASE_SERVICE_ROLE_KEY env'i eksik.)" },
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

  const perPage = 200;
  const users: AdminUserRow[] = [];
  for (let page = 1; page <= 25; page++) {
    const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    for (const u of pageData.users) {
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const uname = (meta?.user_name ?? meta?.preferred_username ?? meta?.nickname) as string | undefined;
      users.push({
        id: u.id,
        email: u.email ?? null,
        username: uname ?? null,
        providers: (u.identities ?? []).map((i) => i.provider),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      });
    }
    if (pageData.users.length < perPage) break; // son sayfaya ulaşıldı
  }

  users.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ users, total: users.length });
}
