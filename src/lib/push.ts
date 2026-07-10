import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Gerçek Web Push — sekme/tarayıcı TAMAMEN kapalıyken bile bildirim gönderir
   (bkz. sounds.ts → notifyReady, o yalnız sekme AÇIKKEN çalışır). VAPID
   anahtarları yoksa sessizce hiçbir şey yapmaz (özellik isteğe bağlıdır). */

let vapidReady: boolean | null = null;

function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) { vapidReady = false; return false; }
  webpush.setVapidDetails("mailto:eneskahveci.bs@gmail.com", pub, priv);
  vapidReady = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

/** Kullanıcının tüm abone cihazlarına push gönderir. VAPID kurulmamışsa
    (env yoksa) veya kullanıcının hiç aboneliği yoksa sessizce çıkar —
    arka plan görevi bundan etkilenmez (best-effort). Süresi dolmuş (410/404)
    abonelikler otomatik silinir. */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) return;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !data?.length) return;

  await Promise.all(data.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }));
}
