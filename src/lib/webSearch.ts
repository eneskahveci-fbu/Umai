import { isSafeRemoteUrl, safeFetch } from "./urlSafety";

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

/* ————— Canlı veri (döviz kuru) — anahtarsız, güncel —————
   Snippet tabanlı arama motorları döviz/altın gibi CANLI verilerde bayat
   kalır (model eğitim verisindeki eski kura düşer). Bu yüzden döviz sorularını
   yakalayıp otoriter, anahtarsız bir FX API'sinden GÜNCEL kuru çekeriz. */

/* Türkçe/İngilizce para birimi adları → ISO 4217 kodu. */
const CURRENCY_WORDS: Record<string, string> = {
  dolar: "USD", usd: "USD", "$": "USD", "amerikan doları": "USD",
  euro: "EUR", avro: "EUR", eur: "EUR", "€": "EUR",
  sterlin: "GBP", pound: "GBP", gbp: "GBP", "£": "GBP",
  tl: "TRY", lira: "TRY", "türk lirası": "TRY", try: "TRY",
  yen: "JPY", jpy: "JPY",
  frank: "CHF", chf: "CHF",
  yuan: "CNY", cny: "CNY",
  ruble: "RUB", rub: "RUB",
  riyal: "SAR", sar: "SAR",
  dirhem: "AED", aed: "AED",
  rupi: "INR", inr: "INR",
  won: "KRW", krw: "KRW",
  "kanada doları": "CAD", cad: "CAD",
  "avustralya doları": "AUD", aud: "AUD",
};

export interface CurrencyQuery { amount: number; from: string; to: string; }

/* "1 dolar kaç tl", "100 euro ne kadar", "usd to try", "dolar tl" → {amount,from,to}.
   Saf fonksiyon → birim testli. Eşleşme yoksa null. */
export function parseCurrencyQuery(text: string): CurrencyQuery | null {
  const lower = (text || "").toLowerCase();
  /* Miktarı HAM metinden çıkar (2,5 / 2.5 bozulmasın); ardından kelime eşleşmesi
     için noktalamayı boşluğa çevir. */
  const amountMatch = lower.match(/(\d+(?:[.,]\d+)?)/);
  const t = lower.replace(/[?!]/g, " ").replace(/(?<!\d)[.,]|[.,](?!\d)/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  /* Metinde geçen para birimlerini sırayla topla (çok kelimeli adlar önce). */
  const names = Object.keys(CURRENCY_WORDS).sort((a, b) => b.length - a.length);
  const found: { code: string; idx: number }[] = [];
  const used: [number, number][] = [];
  for (const name of names) {
    const isWordy = /[a-zçğıöşü]/.test(name);
    const re = isWordy ? new RegExp(`(?:^|[^a-zçğıöşü])(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![a-zçğıöşü])`, "g") : null;
    if (re) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const at = m.index + m[0].indexOf(name);
        if (!used.some(([s, e]) => at < e && at + name.length > s)) { found.push({ code: CURRENCY_WORDS[name], idx: at }); used.push([at, at + name.length]); }
      }
    } else if (t.includes(name)) {
      const at = t.indexOf(name);
      found.push({ code: CURRENCY_WORDS[name], idx: at });
    }
  }
  /* Farklı iki para birimi gerek (aynı kod tekrarı sayılmaz). */
  const ordered = found.sort((a, b) => a.idx - b.idx);
  const distinct: { code: string; idx: number }[] = [];
  for (const f of ordered) if (!distinct.some((d) => d.code === f.code)) distinct.push(f);
  if (distinct.length < 2) return null;
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 1;
  return { amount: amount > 0 ? amount : 1, from: distinct[0].code, to: distinct[1].code };
}

async function liveCurrency(query: string): Promise<SearchResult[]> {
  const cq = parseCurrencyQuery(query);
  if (!cq || cq.from === cq.to) return [];
  /* Frankfurter (ECB, anahtarsız) → open.er-api yedeği. */
  const fetchRate = async (): Promise<{ rate: number; date: string } | null> => {
    try {
      const r = await fetch(`https://api.frankfurter.app/latest?from=${cq.from}&to=${cq.to}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const d = (await r.json()) as { rates?: Record<string, number>; date?: string };
        const rate = d.rates?.[cq.to];
        if (typeof rate === "number") return { rate, date: d.date ?? "" };
      }
    } catch { /* yedeğe düş */ }
    try {
      const r = await fetch(`https://open.er-api.com/v6/latest/${cq.from}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const d = (await r.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
        const rate = d.rates?.[cq.to];
        if (typeof rate === "number") return { rate, date: (d.time_last_update_utc ?? "").slice(0, 16) };
      }
    } catch { /* sonuç yok */ }
    return null;
  };
  const res = await fetchRate();
  if (!res) return [];
  const total = cq.amount * res.rate;
  const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
  return [{
    title: `${fmt(cq.amount)} ${cq.from} = ${fmt(total)} ${cq.to} (güncel kur)`,
    url: "https://www.frankfurter.app",
    snippet: `Güncel döviz kuru${res.date ? ` (${res.date})` : ""}: 1 ${cq.from} = ${fmt(res.rate)} ${cq.to}. ` +
      `${fmt(cq.amount)} ${cq.from} ≈ ${fmt(total)} ${cq.to}. Kaynak: Frankfurter/ECB, anahtarsız canlı veri.`,
  }];
}

/** Sırayla backend'leri dener; ilk dolu sonucu döndürür. Döviz gibi CANLI
    veriler için otoriter sonuç en başa eklenir (arama motoru bayat kalır). */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const live = await liveCurrency(query).catch(() => [] as SearchResult[]);
  for (const backend of [ddgHtml, ddgLite, ddgInstant, wikipedia]) {
    try {
      const r = await backend(query);
      if (r.length) return [...live, ...r];
    } catch { /* sıradakine geç */ }
  }
  return live;
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
  /* SSRF koruması: iç ağ / loopback / bulut metadata adreslerini reddet. */
  if (!isSafeRemoteUrl(url)) return "Bu adres güvenlik nedeniyle getirilemez (iç ağ/loopback engellendi).";
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
    const res = await safeFetch(url, { headers: HTML_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return `Sayfa alınamadı (${res.status}).`;
    const html = await res.text();
    return strip(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")).slice(0, 8000) || "Sayfa boş döndü.";
  } catch {
    return "URL okunamadı.";
  }
}
