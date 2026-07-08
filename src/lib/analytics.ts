import { createClient } from "./supabase/client";
import { useStore } from "./store";

/* Sunucu tarafı ürün analitiği — MVP kapsamı. "Hangi yüzey ne kadar
   kullanılıyor" sorusuna cevap vermek için az sayıda olay Supabase'e yazılır
   (bkz. `supabase/schema.sql` → `analytics_events`, insert-only RLS).
   Üçüncü taraf analytics (GA/Mixpanel vb.) KULLANILMAZ — projenin
   "anahtarsız/gizlilik" ilkesiyle çelişir. Yalnız oturum açık kullanıcılarda
   çalışır (RLS `auth.uid() = user_id` gerektirir); anonim/misafir kullanımda
   sessizce no-op olur — hiçbir akış bu yüzden kesilmez. */
export function trackEvent(eventName: string, surface?: string, metadata?: Record<string, unknown>): void {
  try {
    const userId = useStore.getState().userId;
    if (!userId) return;
    const sb = createClient();
    if (!sb) return;
    void sb.from("analytics_events").insert({
      user_id: userId,
      event_name: eventName,
      surface: surface ?? null,
      metadata: metadata ?? {},
    }).then(() => { /* başarı — beklenen */ }, () => { /* sessizce yoksay, akışı kesme */ });
  } catch {
    /* analitik asla ana akışı bozmasın */
  }
}
