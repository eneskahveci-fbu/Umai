import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { sendPushToUser } from "@/lib/push";
import { usersNeedingCardReminder, cardReminderMessage, type UserConfigRow } from "@/lib/cardReminders";
import { timingSafeEqualStr } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Vercel Cron günde bir kez tetikler (bkz. vercel.json → "0 9 * * *"). Vadesi
   gelmiş Kartlar (Anki) desteleri olan kullanıcılara push bildirimi gönderir
   (yalnız push'a ZATEN abone olanlara — bkz. sendPushToUser, aboneliği
   yoksa sessizce no-op). CRON_SECRET, Vercel'in cron isteklerine otomatik
   eklediği "Authorization: Bearer <CRON_SECRET>" başlığıyla doğrulanır — bu
   Vercel'in kendi dokümante edilmiş davranışıdır. Env'ler yoksa (henüz
   yapılandırılmadıysa) 501 ile nazikçe çıkar; site bundan etkilenmez. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET yapılandırılmamış." }, { status: 501 });
  }
  const auth = req.headers.get("authorization") || "";
  if (!timingSafeEqualStr(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY yapılandırılmamış." }, { status: 501 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await admin.from("user_config").select("user_id, config");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: sentRows } = await admin
    .from("card_reminder_state")
    .select("user_id")
    .eq("last_sent_date", today);
  const sentToday = new Set<string>((sentRows ?? []).map((r: { user_id: string }) => r.user_id));

  const targets = usersNeedingCardReminder((rows ?? []) as UserConfigRow[], sentToday);

  for (const t of targets) {
    const { title, body } = cardReminderMessage(t.dueCount);
    await sendPushToUser(admin, t.userId, { title, body, url: "/studio/araclar?tab=kartlar" });
    await admin.from("card_reminder_state").upsert({ user_id: t.userId, last_sent_date: today });
  }

  return Response.json({ ok: true, notified: targets.length });
}
