import { rateLimit } from "@/lib/rate-limit";
import { isSafeRemoteUrl } from "@/lib/urlSafety";
import { resolveModelAccess } from "@/lib/plan";
import { isProRequest } from "@/lib/serverPlan";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { searchWeb, fetchUrl, type SearchResult } from "@/lib/webSearch";
import { buildHeaders, callModel, streamModel, type LlmCfg } from "@/lib/llmCall";
import type { ChatMessage, Provider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────────────────────
   Derin Araştırma (Claude'un Research moduna paralel).

   Akış:  Alt-sorgu planı → çok-kaynaklı web arama (yelpaze) → üst sayfaları
          oku → ATIFLI markdown rapor (akışlı).
   - Eklenen HANGİ model seçiliyse onunla çalışır (modelden bağımsız).
   - İstemciye OpenAI-uyumlu SSE (`choices[].delta.content`) + ilerleme için
     `swarm_event` (kind:"research") döner — mevcut panel yeniden kullanılır.
   ────────────────────────────────────────────────────────────────────────── */

interface ResearchRequest {
  messages: ChatMessage[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  effort?: "low" | "medium" | "high" | "max";
}

const MAX_QUERIES = 6;
const MAX_SOURCES = 12;   // sentezde atıflanan en çok kaynak
const MAX_FETCH = 5;      // derin okuma için açılacak sayfa sayısı

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

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

export async function POST(req: Request) {
  const __rl = rateLimit(req, "research", 10, 60_000);
  if (__rl) return __rl;
  if (!checkOrigin(req)) return new Response("Geçersiz origin", { status: 403 });

  let body: ResearchRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  /* Pro kapısı (chat/orchestrate ile aynı): sunucu LLM anahtarı yalnız Pro'ya;
     değilse ücretsiz Pollinations'a düş. BYOK herkes için çalışır. */
  let baseUrl = (body.baseUrl || "").replace(/\/$/, "");
  let model = body.model || "";
  let apiKey = body.apiKey || "";
  let provider = (body.provider || "hf") as Provider;
  const providerNeedsKey = provider !== "pollinations" && provider !== "ollama";
  const hasServerKey = !!process.env.LLM_API_KEY;
  const access = resolveModelAccess({
    hasClientKey: !!apiKey,
    providerNeedsKey,
    hasServerKey,
    isPro: !apiKey && hasServerKey && providerNeedsKey ? await isProRequest() : false,
  });
  if (access === "server") {
    baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
    model = body.model || process.env.LLM_MODEL || model;
    apiKey = process.env.LLM_API_KEY || "";
  } else if (access === "free-fallback") {
    baseUrl = "https://text.pollinations.ai/openai";
    provider = "pollinations" as Provider;
    model = model || "openai";
    apiKey = "";
  }
  if (!baseUrl) baseUrl = "https://router.huggingface.co/v1";
  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  if (!apiKey && provider !== "pollinations" && provider !== "ollama") {
    return new Response("API anahtarı yok.", { status: 400 });
  }
  if (process.env.NODE_ENV === "production" && !isSafeRemoteUrl(baseUrl)) {
    return new Response("Güvensiz baseUrl — yalnızca genel (public) adresler kabul edilir.", { status: 400 });
  }

  const cfg: LlmCfg = {
    baseUrl, model, provider,
    headers: buildHeaders(provider, apiKey, req.headers.get("origin") || undefined),
    effort: body.effort,
  };
  const history = (body.messages || []).filter((m) => m.role === "user" || m.role === "assistant");
  const topic = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const ac = new AbortController();
      const signal = ac.signal;
      req.signal.addEventListener("abort", () => ac.abort(), { once: true });
      const send = (content: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      const sendEvent = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const done = () => { controller.enqueue(encoder.encode(`data: [DONE]\n\n`)); controller.close(); };

      try {
        if (!String(topic).trim()) { send("Araştırılacak bir konu bulunamadı."); done(); return; }

        /* ── 1) ALT-SORGU PLANI ── */
        sendEvent({ swarm_event: { kind: "research", phase: "planning", agents: [] } });
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
        const agents = queries.map((q) => ({ title: q, role: "araştırmacı", status: "running" as "running" | "done" | "error" }));
        sendEvent({ swarm_event: { kind: "research", phase: "working", agents } });

        const perQuery = await Promise.all(queries.map(async (q, i) => {
          try {
            const r = await searchWeb(q);
            agents[i].status = "done";
            sendEvent({ swarm_event: { kind: "research", phase: "working", agents } });
            return r;
          } catch {
            agents[i].status = "error";
            sendEvent({ swarm_event: { kind: "research", phase: "working", agents } });
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
          send(`## ${String(topic).slice(0, 120)}\n\nWeb aramasından sonuç alınamadı. Lütfen konuyu biraz daha belirgin ifade edip tekrar dene.`);
          sendEvent({ swarm_event: { kind: "research", phase: "done", agents } });
          done();
          return;
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
            const body = (i < MAX_FETCH ? fetched[i] : "") || s.snippet || "";
            return `[${i + 1}] ${s.title}\nURL: ${s.url}\n${body.slice(0, 1500)}`;
          })
          .join("\n\n---\n\n");

        /* ── 4) ATIFLI RAPOR (akışlı) ── */
        sendEvent({ swarm_event: { kind: "research", phase: "synthesizing", agents } });
        const synthSys =
          (body.systemPrompt || DEFAULT_SYSTEM_PROMPT) + "\n\n" +
          `Sen titiz bir ARAŞTIRMA ANALİSTİSİN. Aşağıdaki numaralı kaynaklara dayanarak konu hakkında ` +
          `kapsamlı, iyi yapılandırılmış bir TÜRKÇE rapor yaz:\n` +
          `• Kısa bir özetle başla, sonra başlıklara böl (## ile).\n` +
          `• Her önemli iddiayı kaynak numarasıyla ATIFLA: cümle sonunda [1], [2] gibi.\n` +
          `• Yalnızca kaynaklardaki bilgiyi kullan; emin olmadığın yeri belirt, uydurma.\n` +
          `• Çelişen kaynak varsa iki tarafı da belirt.\n` +
          `• EN SONDA "## Kaynaklar" başlığı altında her kaynağı listele: "[n] Başlık — URL".`;
        await streamModel(cfg, [
          { role: "system", content: synthSys },
          { role: "user", content: `KONU: ${String(topic).slice(0, 2000)}\n\nKAYNAKLAR:\n\n${sourceBlock}` },
        ], send, signal);

        sendEvent({ swarm_event: { kind: "research", phase: "done", agents } });
        done();
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          send(`\n\n**Araştırma hatası:** ${(e as Error).message}`);
        }
        done();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
