import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hesabı kalıcı sil. Servis anahtarı YALNIZCA sunucuda kullanılır (asla
   istemciye gitmez). Kullanıcı, kendi erişim anahtarıyla (Authorization: Bearer)
   doğrulanır; yalnızca kendi hesabını silebilir. SUPABASE_SERVICE_ROLE_KEY env'i
   tanımlı değilse 501 ile nazikçe reddeder (site bozulmaz). */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Hesap silme sunucuda yapılandırılmamış. (SUPABASE_SERVICE_ROLE_KEY env'i eksik — Vercel'e ekleyince çalışır.)" },
      { status: 501 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Kullanıcıyı kendi token'ıyla doğrula → yalnız kendi hesabını silebilir.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
  const userId = data.user.id;

  // İlişkili verileri temizle (en iyi çaba; tablo yoksa sessizce geç).
  for (const table of ["chats", "user_config", "subscriptions"]) {
    try { await admin.from(table).delete().eq("user_id", userId); } catch { /* yoksay */ }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
