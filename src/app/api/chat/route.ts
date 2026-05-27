import { DEFAULT_SYSTEM_PROMPT, STYLE_LABELS } from "@/lib/constants";
import type { ChatMessage, MemoryItem, Provider, ResponseStyle } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  messages: (ChatMessage | { role: string; content: unknown })[];
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: Provider;
  systemPrompt?: string;
  style?: ResponseStyle;
  memories?: MemoryItem[];
  searchContext?: string;
  projectPrompt?: string;
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

export async function POST(req: Request) {
  if (!checkOrigin(req)) return new Response("Geçersiz origin.", { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRate(ip)) return new Response("İstek limiti aşıldı.", { status: 429 });

  let body: ChatRequest;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek gövdesi", { status: 400 }); }

  const baseUrl = (body.baseUrl || process.env.LLM_BASE_URL || "https://router.huggingface.co/v1").replace(/\/$/, "");
  const model = body.model || process.env.LLM_MODEL || "";
  const apiKey = body.apiKey || process.env.LLM_API_KEY || "";

  if (!model) return new Response("Model seçilmedi.", { status: 400 });
  if (!apiKey) return new Response("API anahtarı yok.", { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  if (body.provider === "openrouter") {
    headers["HTTP-Referer"] = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai.vercel.app";
    headers["X-Title"] = "craft.ai";
  }

  // Sistem promptu oluştur
  let sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (body.projectPrompt) sysPrompt += `\n\n[Proje talimatları]: ${body.projectPrompt}`;
  const styleKey = body.style || "normal";
  const stylePrompt = STYLE_LABELS[styleKey]?.prompt;
  if (stylePrompt) sysPrompt += `\n\n[Stil]: ${stylePrompt}`;
  if (body.memories?.length) {
    sysPrompt += `\n\n[Kullanıcı hakkında bildiklerin]:\n${body.memories.map((m) => `- ${m.content}`).join("\n")}`;
  }
  if (body.searchContext) {
    sysPrompt += `\n\n[Web arama sonuçları — güncel bilgi için kullan]:\n${body.searchContext}`;
  }

  const messages = [{ role: "system", content: sysPrompt }, ...body.messages];

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    });
  } catch (err) {
    return new Response(`Sağlayıcıya bağlanılamadı: ${(err as Error).message}`, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(`Sağlayıcı hatası ${upstream.status}: ${detail.slice(0, 400)}`, { status: upstream.status || 500 });
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
