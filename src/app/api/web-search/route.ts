import { rateLimit } from "@/lib/rate-limit";
import { searchWeb, formatResults, fetchUrl } from "@/lib/webSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Ücretsiz, anahtarsız web arama/okuma (searchOn ön-getirisi kullanır).
   Çoklu backend + gerçek tarayıcı UA için @/lib/webSearch'e bak. */
export async function GET(req: Request) {
  const __rl = rateLimit(req, "web-search", 30, 60_000);
  if (__rl) return __rl;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const url = searchParams.get("url") ?? "";
  try {
    if (url) {
      return new Response(await fetchUrl(url), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (!q) return new Response("Sorgu gerekli.", { status: 400 });
    return new Response(formatResults(await searchWeb(q)), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response(url ? "URL okunamadı." : "Arama başarısız.", { status: 502 });
  }
}
