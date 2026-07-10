import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/* Web Push abonelik uçları — kullanıcı yalnız KENDİ aboneliğini ekler/siler
   (RLS zaten bunu zorunlu kılar, burada ayrıca user_id doğrulanır). */

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "push-subscribe", 10, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return Response.json({ error: "Geçersiz origin." }, { status: 403 });

  let body: SubscribeBody;
  try { body = await req.json(); } catch { return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  const endpoint = (body.endpoint || "").trim();
  const p256dh = (body.keys?.p256dh || "").trim();
  const auth = (body.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) return Response.json({ error: "endpoint ve keys gerekli." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return Response.json({ ok: false, reason: "supabase-yok" });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, reason: "giris-yok" }, { status: 401 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth },
    { onConflict: "endpoint" },
  );
  if (error) return Response.json({ ok: false, reason: error.message.slice(0, 120) });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const __rl = rateLimit(req, "push-unsubscribe", 10, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return Response.json({ error: "Geçersiz origin." }, { status: 403 });

  let body: SubscribeBody;
  try { body = await req.json(); } catch { return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  const endpoint = (body.endpoint || "").trim();
  if (!endpoint) return Response.json({ error: "endpoint gerekli." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return Response.json({ ok: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: true });

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return Response.json({ ok: true });
}
