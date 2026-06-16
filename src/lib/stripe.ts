import Stripe from "stripe";

/* Sunucu tarafı Stripe istemcisi. STRIPE_SECRET_KEY yoksa null → para kazanma
   katmanı kapalı, uygulama BYOK ile ücretsiz çalışmaya devam eder. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://craft-coder.vercel.app";
}
