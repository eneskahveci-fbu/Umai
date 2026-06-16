import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* Yalnızca SUNUCU: service-role anahtarıyla RLS'i aşan yönetici istemci.
   Sadece güvenli sunucu bağlamlarında (Stripe webhook gibi) kullanılır.
   SERVICE_ROLE anahtarı ASLA tarayıcıya gönderilmez; yalnızca env'den okunur.
   Yapılandırılmamışsa null döner. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
