import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Supabase magic-link / OAuth dönüşünde kodu oturuma çevirir. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  /* Açık yönlendirme (open redirect) koruması: yalnız tek '/' ile başlayan
     site-içi yol kabul edilir ('//host' ve mutlak URL reddedilir). */
  const rawNext = searchParams.get("next") ?? "/app";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/app";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
