import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Stripe webhook → abonelik durumunu Supabase 'subscriptions' tablosuna yazar.
   İMZA DOĞRULANIR (ham gövde). Yazma service-role ile (RLS aşılır). Webhook
   IP'leri Stripe'a ait olduğundan IP rate-limit uygulanmaz. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("billing not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (e) {
    return new Response(`Webhook imza hatası: ${(e as Error).message}`, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return new Response("admin not configured", { status: 503 });

  const isActive = (s: string) => s === "active" || s === "trialing";
  /* Stripe yeni API'sinde dönem öğe (item) seviyesinde tutulur. */
  const periodEnd = (sub: Stripe.Subscription): number =>
    sub.items?.data?.[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
  const writeSub = async (row: {
    user_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string;
    status: string;
    current_period_end: number;
  }) => {
    await admin.from("subscriptions").upsert({
      user_id: row.user_id,
      stripe_customer_id: row.stripe_customer_id,
      stripe_subscription_id: row.stripe_subscription_id,
      status: row.status,
      plan: isActive(row.status) ? "pro" : "free",
      current_period_end: new Date(row.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = (s.metadata?.user_id || s.client_reference_id) ?? "";
      if (userId && s.subscription) {
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await writeSub({
          user_id: userId,
          stripe_customer_id: typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null),
          stripe_subscription_id: subId,
          status: sub.status,
          current_period_end: periodEnd(sub),
        });
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id ?? "";
      if (userId) {
        await writeSub({
          user_id: userId,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
          stripe_subscription_id: sub.id,
          status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          current_period_end: periodEnd(sub),
        });
      }
    }
  } catch (e) {
    return new Response(`İşleme hatası: ${(e as Error).message}`, { status: 500 });
  }

  return Response.json({ received: true });
}
