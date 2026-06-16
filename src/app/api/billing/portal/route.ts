import { rateLimit } from "@/lib/rate-limit";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Stripe Müşteri Portalı oturumu — abonelik yönetimi/iptal. Giriş + mevcut
   müşteri gerekir. */
export async function POST(req: Request) {
  const __rl = rateLimit(req, "billing-portal", 10, 60_000);
  if (__rl) return __rl;

  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Ödeme şu an yapılandırılmamış." }, { status: 503 });
  const sb = await createClient();
  if (!sb) return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Giriş gerekli." }, { status: 401 });

  const { data: sub } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = sub?.stripe_customer_id as string | undefined;
  if (!customerId) return Response.json({ error: "Aktif abonelik bulunamadı." }, { status: 400 });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl()}/app`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: `Portal oluşturulamadı: ${(e as Error).message}` }, { status: 500 });
  }
}
