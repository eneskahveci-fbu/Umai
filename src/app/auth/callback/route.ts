import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Supabase magic-link / OAuth dönüşünde kodu oturuma çevirir. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  /* Sağlayıcı (Google/GitHub/GitLab) ya da Supabase'in kendisi OAuth
     adımında başarısız olursa `code` yerine bu parametrelerle döner (ör.
     Redirect URLs izin listesinde bu alan adı yoksa) — önceden bu hiç
     okunmuyordu, kullanıcı hatasız ama oturumsuz şekilde /app'e düşüyordu. */
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  /* Açık yönlendirme (open redirect) koruması: yalnız tek '/' ile başlayan
     site-içi yol kabul edilir ('//host' ve mutlak URL reddedilir). */
  const rawNext = searchParams.get("next") ?? "/app";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/app";

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      /* ÖNCEDEN: exchangeCodeForSession'ın hatası hiç kontrol edilmiyordu —
         değişim başarısız olsa bile (ör. Supabase panelindeki Redirect URLs
         izin listesi güncel değilse, PKCE code_verifier çerezi bulunamazsa)
         kod sessizce ${next}'e yönlendiriyordu: kullanıcı oturumsuz haldeyken
         hiçbir hata görmeden "giriş yapılmış gibi" bir sayfaya düşüyordu. */
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
