import { createClient } from "@/lib/supabase/server";

/* SUNUCU: isteği yapan kullanıcının Pro olup olmadığını Supabase oturumundan
   (cookie) + 'subscriptions' tablosundan (RLS: yalnız kendi durumu) doğrular.
   Supabase yapılandırılmamışsa / giriş yoksa / hata olursa → false (güvenli).
   Asla istisna fırlatmaz; ana akışı bozmaz. */
export async function isProRequest(): Promise<boolean> {
  try {
    const sb = await createClient();
    if (!sb) return false;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await sb
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.plan === "pro" && (data?.status === "active" || data?.status === "trialing");
  } catch {
    return false;
  }
}
