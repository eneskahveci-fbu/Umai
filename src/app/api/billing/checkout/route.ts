import { rateLimit } from "@/lib/rate-limit";
import { getStripe, PRO_PRICE_ID, siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Pro abonelik için Stripe Checkout oturumu oluşturur. Giriş gerekir (user_id).
   Ödeme yapılandırılmamışsa 503 → uygulama BYOK ile çalışmaya devam eder. */
export async function POST(req: Request) {
  const __rl = rateLimit(req, "billing-checkout", 10, 60_000);
  if (__rl) return __rl;

  const stripe = getStripe();
  if (!stripe || !PRO_PRICE_ID) {
    return Response.json({ error: "Ödeme şu an yapılandırılmamış." }, { status: 503 });
  }
  const sb = await createClient();
  if (!sb) return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Pro'ya geçmek için giriş yap." }, { status: 401 });

  const { data: sub } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = (sub?.stripe_customer_id as string | undefined) || undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      customer: customerId,
      customer_email: customerId ? undefined : user.email || undefined,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/app?pro=success`,
      cancel_url: `${siteUrl()}/app?pro=cancel`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: `Checkout oluşturulamadı: ${(e as Error).message}` }, { status: 500 });
  }
}
