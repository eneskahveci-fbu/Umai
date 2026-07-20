import { searchWeb, fetchUrl, type SearchResult } from "./webSearch";
import { callModel, streamModel, type LlmCfg } from "./llmCall";

/* Derin Araştırma çekirdeği — /api/research/route.ts'ten SAF (yan etkisiz
   dışında) bir fonksiyona çıkarıldı: hem mevcut SSE rotası hem de gelecekte
   sohbet araç döngüsündeki (`deep_research` tool) çağrı AYNI mantığı kullanır.
   Akış: alt-sorgu planı → çok-kaynaklı web arama (yelpaze) → üst sayfaları
   oku → atıflı markdown rapor (akışlı). Davranış /api/research ile birebir
   aynı — yalnızca çağıran taraf (route vs. tool) hook'larla farklılaşır. */

export interface ResearchAgent {
  title: string;
  role: string;
  status: "running" | "done" | "error";
  output?: string;
}

export type ResearchPhase = "planning" | "working" | "synthesizing" | "done";

export interface ResearchHooks {
  /** Her aşama geçişinde (ve alt-sorgu sonuçları geldikçe) çağrılır — mevcut
      `swarm_event{kind:"research"}` panelini beslemek için. */
  onPhase?: (phase: ResearchPhase, agents: ResearchAgent[]) => void;
  /** Sentez raporu üretilirken metin parçası geldikçe çağrılır (akışlı UI için). */
  onSynthChunk?: (text: string) => void;
  signal?: AbortSignal;
}

const MAX_QUERIES = 6;
const MAX_SOURCES = 12;   // sentezde atıflanan en çok kaynak
const MAX_FETCH = 5;      // derin okuma için açılacak sayfa sayısı

/* Planlayıcı JSON'undan alt sorguları çıkar (kod bloğu/fazla metne dayanıklı). */
function parseQueries(raw: string, fallback: string): string[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as { queries?: unknown };
      if (Array.isArray(obj.queries)) {
        const qs = obj.queries
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .map((q) => q.trim())
          .slice(0, MAX_QUERIES);
        if (qs.length) return qs;
      }
    } catch { /* yedeğe düş */ }
  }
  return [fallback.slice(0, 200)];
}

const formatSources = (list: SearchResult[]): string =>
  list.length
    ? list.slice(0, 5).map((r) => `- [${r.title || r.url}](${r.url})`).join("\n")
    : "(kaynak bulunamadı)";

/** Konu için atıflı bir araştırma raporu üretir; tam metni döner (akışlı
    parçalar `onSynthChunk` ile de bildirilir). Kaynak bulunamazsa nazik bir
    mesaj döner (hata fırlatmaz — çağıran taraf bunu normal bir sonuç sayar). */
export async function runDeepResearch(
  cfg: LlmCfg,
  topic: string,
  systemPromptBase: string,
  hooks: ResearchHooks = {},
): Promise<string> {
  const signal = hooks.signal ?? new AbortController().signal;
  if (!String(topic).trim()) {
    const msg = "Araştırılacak bir konu bulunamadı.";
    hooks.onSynthChunk?.(msg);
    return msg;
  }

  /* ── 1) ALT-SORGU PLANI ── */
  hooks.onPhase?.("planning", []);
  const planRaw = await callModel(cfg, [
    {
      role: "system",
      content:
        `Sen bir araştırma planlayıcısısın. Kullanıcının konusunu web'de aranacak 3-${MAX_QUERIES} ODAKLI, ` +
        `birbirini TAMAMLAYAN alt sorguya böl (farklı açılar, alt-başlıklar, karşıt görüşler). ` +
        `SADECE şu JSON ile yanıt ver, başka hiçbir şey yazma:\n{"queries":["...","..."]}`,
    },
    { role: "user", content: `Konu:\n${String(topic).slice(0, 2000)}` },
  ], signal);
  const queries = parseQueries(planRaw, String(topic));

  /* ── 2) YELPAZE ARAMA (paralel) ── */
  const agents: ResearchAgent[] = queries.map((q) => ({
    title: q, role: "araştırmacı", status: "running",
  }));
  hooks.onPhase?.("working", agents);

  const perQuery = await Promise.all(queries.map(async (q, i) => {
    try {
      const r = await searchWeb(q);
      agents[i].status = "done";
      agents[i].output = formatSources(r);
      hooks.onPhase?.("working", agents);
      return r;
    } catch {
      agents[i].status = "error";
      agents[i].output = "(arama başarısız oldu)";
      hooks.onPhase?.("working", agents);
      return [] as SearchResult[];
    }
  }));

  /* Kaynakları tekilleştir (URL'e göre) ve numaralandır. */
  const seen = new Set<string>();
  const sources: SearchResult[] = [];
  for (const list of perQuery) {
    for (const r of list) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      sources.push(r);
      if (sources.length >= MAX_SOURCES) break;
    }
    if (sources.length >= MAX_SOURCES) break;
  }

  if (sources.length === 0) {
    const msg = `## ${String(topic).slice(0, 120)}\n\nWeb aramasından sonuç alınamadı. Lütfen konuyu biraz daha belirgin ifade edip tekrar dene.`;
    hooks.onSynthChunk?.(msg);
    hooks.onPhase?.("done", agents);
    return msg;
  }

  /* ── 3) ÜST SAYFALARI DERİN OKU ── */
  const fetched = await Promise.all(
    sources.slice(0, MAX_FETCH).map(async (s) => {
      try { return await fetchUrl(s.url); } catch { return ""; }
    }),
  );

  /* Sentez için numaralı kaynak bağlamı. */
  const sourceBlock = sources
    .map((s, i) => {
      const pageBody = (i < MAX_FETCH ? fetched[i] : "") || s.snippet || "";
      return `[${i + 1}] ${s.title}\nURL: ${s.url}\n${pageBody.slice(0, 1500)}`;
    })
    .join("\n\n---\n\n");

  /* ── 4) ATIFLI RAPOR (akışlı) ── */
  hooks.onPhase?.("synthesizing", agents);
  const synthSys =
    systemPromptBase + "\n\n" +
    `Sen titiz bir ARAŞTIRMA ANALİSTİSİN. Aşağıdaki numaralı kaynaklara dayanarak konu hakkında ` +
    `kapsamlı, iyi yapılandırılmış bir TÜRKÇE rapor yaz:\n` +
    `• Kısa bir özetle başla, sonra başlıklara böl (## ile).\n` +
    `• Her önemli iddiayı kaynak numarasıyla ATIFLA: cümle sonunda [1], [2] gibi.\n` +
    `• Yalnızca kaynaklardaki bilgiyi kullan; emin olmadığın yeri belirt, uydurma.\n` +
    `• Çelişen kaynak varsa iki tarafı da belirt.\n` +
    `• EN SONDA "## Kaynaklar" başlığı altında her kaynağı listele: "[n] Başlık — URL".`;

  let full = "";
  await streamModel(cfg, [
    { role: "system", content: synthSys },
    { role: "user", content: `KONU: ${String(topic).slice(0, 2000)}\n\nKAYNAKLAR:\n\n${sourceBlock}` },
  ], (chunk) => { full += chunk; hooks.onSynthChunk?.(chunk); }, signal);

  hooks.onPhase?.("done", agents);
  return full;
}
