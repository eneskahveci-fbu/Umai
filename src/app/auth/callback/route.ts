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

  /* BAĞLAMA (linkIdentity) mı, giriş/kayıt/magic-link mi? Ayrım önemli: bir
     hesap BAĞLAMA denemesi TANIM GEREĞİ zaten oturum açmış bir kullanıcıda
     çalışır (SettingsModal.tsx connectGitOAuth → linkIdentity, next=
     "/app?gitlink=…"). ÖNCEDEN bağlama başarısız olduğunda (ör. "Identity is
     already linked to another user", PKCE code_verifier çerezi bulunamadı)
     kullanıcı KOŞULSUZ /login'e atılıyordu; /login zaten girişli olup
     olmadığına hiç bakmadığı için kullanıcı, oturumu aslında hâlâ geçerliyken
     "hesabımdan çıktı" izlenimine kapılıyordu ("GitHub'a tıklayınca login
     ekranına atıp hesaptan çıkarıyor" raporu tam buydu). Bağlama denemesinde
     hata olursa artık /login'e DEĞİL, doğrudan /app'e (next'e) bir hata
     query'siyle dönülür — app/page.tsx'teki gitlink efekti bunu toast olarak
     gösterir, kullanıcı uygulamadan hiç kopmaz. */
  const isLinkAttempt = next.includes("gitlink=");
  const backToAppWithError = (msg: string) => {
    const sep = next.includes("?") ? "&" : "?";
    return `${origin}${next}${sep}link_error=${encodeURIComponent(msg)}`;
  };

  if (oauthError) {
    return NextResponse.redirect(
      isLinkAttempt ? backToAppWithError(oauthError) : `${origin}/login?error=${encodeURIComponent(oauthError)}`,
    );
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
        return NextResponse.redirect(
          isLinkAttempt ? backToAppWithError(error.message) : `${origin}/login?error=${encodeURIComponent(error.message)}`,
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
