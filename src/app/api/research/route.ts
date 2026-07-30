import { PLATFORM_KNOWLEDGE_BRIEF } from "@/lib/platform-knowledge";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeRemoteUrl } from "@/lib/urlSafety";
import { resolveModelAccess } from "@/lib/plan";
import { isProRequest } from "@/lib/serverPlan";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";
import { buildHeaders, type LlmCfg } from "@/lib/llmCall";
import { runDeepResearch } from "@/lib/researchPipeline";
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

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
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
        /* Ö2: derin araştırma yolu da platform dizinini alır — rapor içinde
           Umai'nin kendi yüzeylerinden söz edilirse doğru olsun. */
        await runDeepResearch(cfg, String(topic), `${body.systemPrompt || DEFAULT_SYSTEM_PROMPT}\n\n${PLATFORM_KNOWLEDGE_BRIEF}`, {
          signal,
          onPhase: (phase, agents) => sendEvent({ swarm_event: { kind: "research", phase, agents } }),
          onSynthChunk: send,
        });
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
