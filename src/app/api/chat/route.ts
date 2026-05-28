import { DEFAULT_SYSTEM_PROMPT, STYLE_LABELS } from "@/lib/constants";
import { CODER_TOOLS } from "@/lib/tools";
import type { ChatMessage, MemoryItem, Provider, ResponseStyle } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RepoCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
}

interface ChatRequest {
  messages: (ChatMessage | { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string })[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  style?: ResponseStyle;
  memories?: MemoryItem[];
  searchContext?: string;
  projectPrompt?: string;
  tools?: boolean;
  repoCtx?: RepoCtx;
}

const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.reset) { rl.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 30) return false;
  e.count++;
  return true;
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* ── Tool execution ── */

async function ghHeaders(token?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function execListFiles(ctx: RepoCtx, args: { filter?: string }): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: await ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} ${await res.text()}`;
  const data = await res.json();
  const filter = args.filter?.toLowerCase();
  const items = (data.tree as { path: string; type: string }[])
    .filter((t) => t.type === "blob")
    .map((t) => t.path)
    .filter((p) => !filter || p.toLowerCase().includes(filter));
  if (items.length > 200) {
    return items.slice(0, 200).join("\n") + `\n\n[${items.length - 200} dosya daha gizlendi — filtre kullan]`;
  }
  return items.join("\n") || "(eşleşen dosya yok)";
}

async function execReadFile(ctx: RepoCtx, args: { path: string }): Promise<string> {
  if (!args.path) return "Hata: path boş";
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(args.path)}?ref=${ctx.branch}`,
    { headers: await ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${args.path})`;
  const data = await res.json();
  if (data.size > 100_000) return `Hata: dosya çok büyük (${data.size} bayt). 100KB üstü desteklenmiyor.`;
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.length > 20_000 ? content.slice(0, 20_000) + "\n\n[... kısaltıldı]" : content;
}

async function execSearchFiles(ctx: RepoCtx, args: { query: string }): Promise<string> {
  if (!args.query) return "Hata: query boş";
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`,
    { headers: await ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json();
  const q = args.query.toLowerCase();
  const matches = (data.tree as { path: string; type: string }[])
    .filter((t) => t.type === "blob" && t.path.toLowerCase().includes(q))
    .map((t) => t.path)
    .slice(0, 50);
  return matches.length ? matches.join("\n") : "(eşleşme yok)";
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: RepoCtx,
): Promise<string> {
  if (!ctx) return "Hata: repo bağlı değil. Kullanıcıya GitHub deposu bağlamasını söyle.";
  try {
    if (name === "list_files") return await execListFiles(ctx, args as { filter?: string });
    if (name === "read_file") return await execReadFile(ctx, args as { path: string });
    if (name === "search_files") return await execSearchFiles(ctx, args as { query: string });
    return `Bilinmeyen araç: ${name}`;
  } catch (e) {
    return `Hata: ${(e as Error).message}`;
  }
}

/* ── Stream parser helpers ── */

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

interface RoundResult {
  content: string;
  toolCalls: AccumulatedToolCall[];
  finishReason: string | null;
}

async function streamRound(
  upstream: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): Promise<RoundResult> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls: AccumulatedToolCall[] = [];
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          /* forward content deltas */
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`),
          );
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let acc = toolCalls.find((c) => c.index === idx);
            if (!acc) {
              acc = { index: idx, id: tc.id || `call_${idx}`, name: "", arguments: "" };
              toolCalls.push(acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        /* parçalı satır */
      }
    }
  }
  return { content, toolCalls, finishReason };
}

function friendlyApiError(status: number, rawDetail: string, provider?: Provider): string {
  try {
    const json = JSON.parse(rawDetail);
    const msg: string = json?.error?.message || json?.message || json?.error || "";
    if (msg.toLowerCase().includes("insufficient balance") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource exhausted"))
      return `Yetersiz bakiye/kota (${status}): Sağlayıcı hesabına kredi yükle veya ödeme yöntemini ekle.`;
    if (msg.toLowerCase().includes("invalid api key") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("permission denied") || status === 401)
      return `API anahtarı geçersiz (${status}): Ayarlardan anahtarı kontrol et.`;
    if (msg.toLowerCase().includes("rate limit") || status === 429)
      return `İstek limiti aşıldı (${status}): Biraz bekle ve tekrar dene.`;
    if (msg) return `Sağlayıcı hatası (${status}): ${msg}`;
  } catch { /* raw text */ }
  if (status === 401) return "API anahtarı geçersiz (401): Ayarlardan anahtarı kontrol et.";
  if (status === 402) return "Yetersiz bakiye (402): Sağlayıcı hesabına kredi yükle.";
  if (status === 429) return "İstek limiti aşıldı (429): Biraz bekle ve tekrar dene.";
  if (status === 400) return `İstek hatası (${status}): Provider ayarları veya model adı hatalı olabilir. Kontrol et ve tekrar dene.`;
  if (status >= 500) return `Sağlayıcı sunucu hatası (${status}): Kısa süre sonra tekrar dene.`;
  return `Sağlayıcı hatası (${status}): ${rawDetail.slice(0, 200)}`;
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) return new Response("Geçersiz origin.", { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRate(ip)) return new Response("İstek limiti aşıldı.", { status: 429 });

  let body: ChatRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  const baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
  const model = body.model || process.env.LLM_MODEL || "";
  const apiKey = body.apiKey || process.env.LLM_API_KEY || "";
  const provider = body.provider || "hf";

  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  if (!apiKey) return new Response("API anahtarı yok.", { status: 400 });

  const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
  
  /* Provider-specific header setup */
  if (provider === "gemini") {
    /* Gemini API Key parametresi URL'de gider */
    upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;
  } else {
    upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;
  }
  
  if (provider === "openrouter") {
    upstreamHeaders["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-coder.vercel.app";
    upstreamHeaders["X-Title"] = "craft.ai";
  }

  let sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (body.projectPrompt) sysPrompt += `\n\n[Proje talimatları]: ${body.projectPrompt}`;
  const styleKey = body.style || "normal";
  const stylePrompt = STYLE_LABELS[styleKey]?.prompt;
  if (stylePrompt) sysPrompt += `\n\n[Stil]: ${stylePrompt}`;
  if (body.memories?.length) {
    sysPrompt += `\n\n[Kullanıcı hakkında bildiklerin]:\n${body.memories.map((m) => `- ${m.content}`).join("\n")}`;
  }
  if (body.searchContext) {
    sysPrompt += `\n\n[Web arama sonuçları]:\n${body.searchContext}`;
  }
  if (body.tools && body.repoCtx) {
    sysPrompt +=
      `\n\n[Araç kullanımı]: Bağlı repo: ${body.repoCtx.owner}/${body.repoCtx.repo}:${body.repoCtx.branch}. ` +
      `list_files, read_file, search_files araçlarını kullanarak repo'yu keşfedebilirsin. ` +
      `Cevap vermeden önce gerekli dosyaları oku. Aynı dosyayı tekrar tekrar okuma. ` +
      `Çok dosya yerine en kritik 1-3 dosyayı oku.`;
  }

  /* Tool-use disabled: simple passthrough */
  if (!body.tools || !body.repoCtx) {
    const messages = [{ role: "system", content: sysPrompt }, ...body.messages];
    let upstream: Response;
    let url = `${baseUrl}/chat/completions`;
    
    /* Gemini API format adjustment */
    if (provider === "gemini") {
      url = `${baseUrl}/chat/completions?key=${apiKey}`;
    }
    
    try {
      upstream = await fetch(url, {
        method: "POST", headers: upstreamHeaders,
        body: JSON.stringify({ model, messages, stream: true }),
      });
    } catch (err) {
      return new Response(`Sağlayıcıya bağlanılamadı: ${(err as Error).message}`, { status: 502 });
    }
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response(friendlyApiError(upstream.status, detail, provider), { status: upstream.status || 500 });
    }
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  }

  /* Tool-use loop */
  const repoCtx = body.repoCtx;
  const convo: ChatRequest["messages"] = [
    { role: "system", content: sysPrompt },
    ...body.messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const MAX_ROUNDS = 6;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        let upstream: Response;
        let url = `${baseUrl}/chat/completions`;
        
        /* Gemini API format adjustment */
        if (provider === "gemini") {
          url = `${baseUrl}/chat/completions?key=${apiKey}`;
        }
        
        try {
          upstream = await fetch(url, {
            method: "POST", headers: upstreamHeaders,
            body: JSON.stringify({
              model,
              messages: convo,
              stream: true,
              tools: CODER_TOOLS,
              tool_choice: round === MAX_ROUNDS - 1 ? "none" : "auto",
            }),
          });
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**Bağlantı hatası:** ${(err as Error).message}` } }] })}\n\n`));
          break;
        }
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**${friendlyApiError(upstream.status, detail, provider)}` } }] })}\n\n`));
          break;
        }

        const { content, toolCalls, finishReason } = await streamRound(upstream, controller, encoder);

        if (toolCalls.length === 0 || finishReason === "stop") break;

        /* Append assistant turn with tool calls */
        convo.push({
          role: "assistant",
          content: content || "",
          tool_calls: toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        });

        /* Execute and send results */
        for (const tc of toolCalls) {
          /* notify client of tool call */
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "start", id: tc.id, name: tc.name, arguments: tc.arguments } })}\n\n`),
          );
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { /* invalid */ }
          const result = await executeTool(tc.name, args, repoCtx);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_event: { phase: "end", id: tc.id, name: tc.name, result: result.slice(0, 400) + (result.length > 400 ? "…" : "") } })}\n\n`),
          );
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
