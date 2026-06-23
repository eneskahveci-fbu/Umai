/* OpenAI-uyumlu sağlayıcılara tek/akışlı model çağrısı için paylaşılan yardımcılar.
   /api/orchestrate ve /api/research aynı mantığı kullanır (kod tekrarını önler). */
import type { Provider } from "./types";

export type Effort = "low" | "medium" | "high" | "max";

export interface LlmCfg {
  baseUrl: string;
  model: string;
  provider: Provider;
  headers: Record<string, string>;
  effort?: Effort;
}

/* Sağlayıcıya göre header — /api/chat ile birebir aynı mantık. */
export function buildHeaders(provider: Provider, apiKey: string, origin?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") {
    h["anthropic-version"] = "2023-06-01";
    h["x-api-key"] = apiKey;
  } else if (apiKey) {
    h["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider === "openrouter") {
    h["HTTP-Referer"] = origin || process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app";
    h["X-Title"] = "Craft Coder";
  }
  return h;
}

/* Efor → max_tokens + reasoning (chat route ile aynı ölçek). */
const EFFORT_TOKENS: Record<Effort, number> = { low: 4096, medium: 8192, high: 16384, max: 32768 };
export function applyEffort(body: Record<string, unknown>, cfg: LlmCfg) {
  if (!cfg.effort) return;
  body.max_tokens = EFFORT_TOKENS[cfg.effort];
  if (cfg.provider === "openrouter") {
    body.reasoning = { effort: cfg.effort === "max" ? "high" : cfg.effort };
  }
}

/* Tek, akışsız (non-streaming) model çağrısı → düz metin döndürür. */
export async function callModel(
  cfg: LlmCfg,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: false };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
  applyEffort(body, cfg);
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Model hatası ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/* Akışlı model çağrısı → her delta'yı `send` ile istemciye yolla. */
export async function streamModel(
  cfg: LlmCfg,
  messages: { role: string; content: string }[],
  send: (content: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: true };
  if (cfg.provider === "pollinations") body.referrer = "craft-coder";
  applyEffort(body, cfg);
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: cfg.headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    send(`\n\n**Akış hatası ${res.status}:** ${detail.slice(0, 200)}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const c = json.choices?.[0]?.delta?.content;
        if (c) send(c);
      } catch { /* parçalı JSON — atla */ }
    }
  }
}
