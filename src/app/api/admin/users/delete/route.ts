import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isAdminEmail } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin — BAŞKA bir kullanıcının hesabını kalıcı siler (sohbetler, ayarlar,
   varsa abonelik dahil). GERİ ALINAMAZ. Kullanılma amacı: bir GitHub/GitLab
   kimliği eski/test bir hesaba takılı kalıp "Identity is already linked to
   another user" hatası verdiğinde, o hesabı silip kimliği serbest bırakmak
   (Supabase admin API'sinde TEK bir kimliği başka bir kullanıcıdan ayırma
   uç noktası yok — yalnızca kullanıcının TAMAMINI silmek mümkün).

   Güvenlik: /api/account/delete (kendi hesabını silme) ile AYNI desen +
   ek olarak: (1) çağıran admin olmalı, (2) hedef KENDİSİ olamaz — admin
   panelinden "yanlışlıkla kendini sil" riskini API seviyesinde kapatır,
   (3) hedef başka bir admin olamaz — bir admin diğerini API üzerinden
   düşüremez (yalnızca ADMIN_EMAILS listesi düzenlenerek yapılabilir). */
export async function POST(request: Request) {
  const __rl = rateLimit(request, "admin-users-delete", 10, 60_000);
  if (__rl) return __rl;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Kullanıcı silme sunucuda yapılandırılmamış. (SUPABASE_SERVICE_ROLE_KEY env'i eksik.)" },
      { status: 501 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetId) return NextResponse.json({ error: "userId zorunlu." }, { status: 400 });

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData.user) return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
  if (!isAdminEmail(callerData.user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  if (targetId === callerData.user.id) {
    return NextResponse.json({ error: "Kendi hesabını buradan silemezsin — Ayarlar → Hesap'tan sil." }, { status: 400 });
  }

  const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(targetId);
  if (targetErr || !targetData.user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  if (isAdminEmail(targetData.user.email)) {
    return NextResponse.json({ error: "Başka bir admin hesabı buradan silinemez." }, { status: 403 });
  }

  /* İlişkili verileri temizle (en iyi çaba; tablo yoksa sessizce geç) —
     /api/account/delete ile aynı liste. */
  for (const table of ["chats", "user_config", "subscriptions"]) {
    try { await admin.from(table).delete().eq("user_id", targetId); } catch { /* yoksay */ }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  /* İzlenebilirlik: kim, ne zaman, kimi sildi — sunucu logunda kalır (Vercel
     fonksiyon logları). Kalıcı bir denetim tablosu değil; ama bir sorun
     çıkarsa geriye dönük bakılabilecek en ucuz kayıt budur. */
  console.info(
    `[admin] Kullanıcı silindi — admin=${callerData.user.email} hedef=${targetData.user.email ?? targetId} (${targetId}) zaman=${new Date().toISOString()}`,
  );

  return NextResponse.json({ ok: true });
}
