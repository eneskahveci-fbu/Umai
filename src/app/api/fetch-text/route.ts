import { NextResponse } from "next/server";
import { isSafeRemoteUrl, safeFetch } from "@/lib/urlSafety";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Metin getirme proxy'si — tarayıcının CORS engeline takılan kaynaklardan
   (GitHub raw, gist, herhangi bir public URL) düz metin çeker. Skill/ajan içe
   aktarmada kullanılır. SSRF koruması: yalnız genel (public) http(s) adresler. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "fetch-text", 30, 60_000);
  if (limited) return limited;
  const u = new URL(req.url).searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(u)) {
    return NextResponse.json({ error: "Geçerli bir http(s) URL gerekli." }, { status: 400 });
  }
  if (!isSafeRemoteUrl(u)) {
    return NextResponse.json({ error: "Güvensiz adres — yalnız genel (public) URL'ler." }, { status: 400 });
  }
  try {
    // gist sayfa URL'sini ham içeriğe çevir (kolaylık).
    const target = u.replace(/^https:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)$/i, "https://gist.githubusercontent.com/$1/$2/raw");
    const r = await safeFetch(target, {
      headers: { Accept: "text/plain, text/markdown, application/json, */*", "User-Agent": "craft-ai" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return NextResponse.json({ error: `Kaynak ${r.status} döndü.` }, { status: 502 });
    const text = (await r.text()).slice(0, 20000);
    if (!text.trim()) return NextResponse.json({ error: "Boş içerik." }, { status: 502 });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Getirilemedi." }, { status: 502 });
  }
}
