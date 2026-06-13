/* Ücretsiz, anahtarsız web arama + sayfa okuma. Tek kaynak: chat route'unun
   web_search/read_url araçları, /api/web-search ve /api/search bunu kullanır.

   ÖNEMLİ: Sunucu (Vercel datacenter IP) isteklerinde DuckDuckGo, bot benzeri
   User-Agent'ları 403 ile reddeder. Bu yüzden GERÇEK bir tarayıcı UA + tarayıcı
   header'ları gönderiyoruz ve birden fazla backend'i sırayla deniyoruz:
   DDG HTML → DDG Lite → DDG Instant Answer (JSON) → Wikipedia. İlk dolu sonuç
   kazanır. Böylece anahtarsız ve ücretsiz çalışır. */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HTML_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
};

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

/* DuckDuckGo gizli yönlendirme URL'ini (uddg=) gerçek URL'e çöz. */
function unwrapDdgUrl(href: string): string {
  try {
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch { /* yok say */ }
  return href.startsWith("//") ? "https:" + href : href;
}

async function ddgHtml(q: string): Promise<SearchResult[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: HTML_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: SearchResult[] = [];
  for (const block of html.split("result__body").slice(1, 10)) {
    const a = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    if (a) out.push({ title: strip(a[2]), url: unwrapDdgUrl(a[1]), snippet: snippet ? strip(snippet) : "" });
  }
  return out;
}

async function ddgLite(q: string): Promise<SearchResult[]> {
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, {
    headers: HTML_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: SearchResult[] = [];
  const linkRe = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(strip(sm[1]));
  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && out.length < 10) {
    out.push({ title: strip(lm[2]), url: unwrapDdgUrl(lm[1]), snippet: snippets[i] ?? "" });
    i++;
  }
  return out;
}

async function ddgInstant(q: string): Promise<SearchResult[]> {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const d = (await res.json()) as {
    Heading?: string; AbstractText?: string; AbstractURL?: string;
    RelatedTopics?: { Text?: string; FirstURL?: string }[];
  };
  const out: SearchResult[] = [];
  if (d.AbstractText) out.push({ title: d.Heading || q, url: d.AbstractURL || "", snippet: d.AbstractText });
  for (const t of d.RelatedTopics ?? []) {
    if (t.Text && t.FirstURL) out.push({ title: t.Text.slice(0, 90), url: t.FirstURL, snippet: t.Text });
    if (out.length >= 8) break;
  }
  return out;
}

async function wikipedia(q: string): Promise<SearchResult[]> {
  const res = await fetch(`https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=6&origin=*`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const d = (await res.json()) as { query?: { search?: { title: string; snippet?: string }[] } };
  return (d.query?.search ?? []).map((s) => ({
    title: s.title,
    url: `https://tr.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
    snippet: strip(s.snippet ?? ""),
  }));
}

/** Sırayla backend'leri dener; ilk dolu sonucu döndürür. */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  for (const backend of [ddgHtml, ddgLite, ddgInstant, wikipedia]) {
    try {
      const r = await backend(query);
      if (r.length) return r;
    } catch { /* sıradakine geç */ }
  }
  return [];
}

/** Arama sonuçlarını LLM/istemci için okunabilir metne çevirir. */
export function formatResults(results: SearchResult[]): string {
  if (!results.length) return "Sonuç bulunamadı.";
  return results
    .slice(0, 8)
    .map((r) => `• ${r.title}${r.url ? `\n  ${r.url}` : ""}${r.snippet ? `\n  ${r.snippet}` : ""}`)
    .join("\n\n")
    .slice(0, 6000);
}

/** Bir sayfayı okur: önce Jina reader (temiz metin), başarısızsa doğrudan
    getirip HTML etiketlerini temizler. Anahtarsız. */
export async function fetchUrl(rawUrl: string): Promise<string> {
  let url = rawUrl.trim();
  if (!url) return "URL boş.";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const t = await res.text();
      if (t.trim()) return t.slice(0, 8000);
    }
  } catch { /* yedeğe düş */ }
  try {
    const res = await fetch(url, { headers: HTML_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return `Sayfa alınamadı (${res.status}).`;
    const html = await res.text();
    return strip(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")).slice(0, 8000) || "Sayfa boş döndü.";
  } catch {
    return "URL okunamadı.";
  }
}
