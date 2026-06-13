export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Ücretsiz, anahtarsız web arama/okuma. Eskiden Jina (s.jina.ai / r.jina.ai)
   kullanılıyordu ama anonim katman artık 402/451 veriyor. Arama için DuckDuckGo
   HTML, sayfa okuma için Jina reader + doğrudan-getir yedeği. */

const UA = "Mozilla/5.0 (compatible; Craft.Coder/1.0)";

async function searchDuckDuckGo(q: string): Promise<string> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return `Arama başarısız (${res.status}).`;
  const html = await res.text();
  const out: string[] = [];
  for (const block of html.split("result__body").slice(1, 9)) {
    const title = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const urlText = block.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
    if (title) out.push(`• ${title}${urlText ? `\n  ${urlText}` : ""}${snippet ? `\n  ${snippet}` : ""}`);
  }
  return out.length ? out.join("\n\n").slice(0, 6000) : "Sonuç bulunamadı.";
}

async function readUrl(rawUrl: string): Promise<string> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) { const t = await res.text(); if (t.trim()) return t.slice(0, 8000); }
  } catch { /* yedeğe düş */ }
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return `Sayfa alınamadı (${res.status}).`;
  const html = await res.text();
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000) || "Sayfa boş döndü."
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const url = searchParams.get("url") ?? "";

  try {
    if (url) {
      const text = await readUrl(url);
      return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (!q) return new Response("Sorgu gerekli.", { status: 400 });
    const text = await searchDuckDuckGo(q);
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response(url ? "URL okunamadı." : "Arama başarısız.", { status: 502 });
  }
}
