export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const url = searchParams.get("url") ?? "";

  if (url) {
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { "Accept": "text/plain", "X-Return-Format": "text" },
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      return new Response(text.slice(0, 8000), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch {
      return new Response("URL okunamadı.", { status: 502 });
    }
  }

  if (!q) return new Response("Sorgu gerekli.", { status: 400 });

  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(q)}`, {
      headers: { "Accept": "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    return new Response(text.slice(0, 6000), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response("Arama başarısız.", { status: 502 });
  }
}
