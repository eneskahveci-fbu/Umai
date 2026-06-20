import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/supabase/config";

/* ─── Rate limit (in-memory; per instance) ─── */
const rate = new Map<string, { count: number; reset: number }>();
const API_RATE_LIMIT = 60;
const API_RATE_WINDOW_MS = 60_000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function rateLimit(ip: string, pathname: string): boolean {
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rate.get(key);
  if (!entry || now > entry.reset) {
    rate.set(key, { count: 1, reset: now + API_RATE_WINDOW_MS });
    if (rate.size > 5000) {
      for (const [k, v] of rate) if (now > v.reset) rate.delete(k);
    }
    return true;
  }
  if (entry.count >= API_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  /* 1) /api/* için rate limit (auth gerektirmez) */
  if (path.startsWith("/api/")) {
    const ip = clientIp(request);
    if (!rateLimit(ip, path)) {
      return new NextResponse("İstek limiti aşıldı. Lütfen biraz bekle.", {
        status: 429,
        headers: {
          "Retry-After": "60",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
    return NextResponse.next();
  }

  /* 2) Supabase yapılandırılmamışsa devam et */
  if (!supabaseConfigured) {
    return NextResponse.next();
  }

  /* 3) Auth-aware redirect (yalnızca /app ve /login) */
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && path.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/api/:path*"],
};
