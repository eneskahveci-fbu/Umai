/* Paylaşılan istemci-taraflı LLM akış yardımcısı — stüdyo üretim motorlarının
   (slides/docs/forms/defter) ortak çekirdeği: aktif modeli çözer, /api/chat'e
   akışlı istek atar, SSE delta'larını toplar. Anahtarsız kullanıcıda fallback
   zinciri ücretsiz Pollinations'a düşer → her zaman çalışır. */
import { useStore } from "./store";
import { buildFallbackChain } from "./fallback";
import { resolveKey } from "./studioGen";
import { buildContextSections, selectRelevantSkills } from "./prompt";

export interface GenChatOptions {
  system: string;
  /** Tek kullanıcı mesajı yerine tam geçmiş vermek için (Defter sohbeti). */
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  /** Sunucunun varsayılan 8192 token tavanını aşmak için (ör. çok slaytlı
      sunum gibi büyük yapılandırılmış çıktılarda yanıt ortada kesilmesin). */
  maxTokens?: number;
  /** Yalnız geçerli JSON bekleniyorsa (ör. sunum motoru) — destekleyen
      sağlayıcılarda native JSON modu istenir (bkz. api/chat/route.ts). */
  jsonMode?: boolean;
  onDelta?: (fullText: string) => void;
  signal?: AbortSignal;
}

/** Akışlı sohbet tamamlama — birikmiş tam metni döndürür. */
export async function streamChat(opts: GenChatOptions): Promise<string> {
  const resolved = await resolveKey();
  if (!resolved) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
  const cfg = useStore.getState().config;
  /* Kullanıcının etkin eğitim setleri (Skills) yalnız sohbette değil, tüm
     stüdyo üretimlerinde (Doküman/Anket/Defter/Sunum) de uygulansın — bu
     ortak çekirdek üzerinden tek noktadan enjekte edilir. K1: önceden
     dizideki İLK 5'i alaka gözetmeden alıyordu (CoderView'daki ana sohbet
     yolunun aksine); artık AYNI anahtar-kelime örtüşme seçimini kullanıyor
     (selectRelevantSkills, prompt.ts) — brief/son kullanıcı mesajıyla en
     alakalı 5 seçilir, prompt yine şişmez. */
  const lastUserText = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const enabledSkills = selectRelevantSkills((cfg.skills ?? []).filter((s) => s.enabled), lastUserText);
  const system = enabledSkills.length ? opts.system + buildContextSections({ skills: enabledSkills }) : opts.system;
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      messages: opts.messages,
      baseUrl: resolved.baseUrl, model: resolved.model, apiKey: resolved.apiKey, provider: resolved.provider,
      systemPrompt: system,
      fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
      tools: false, webSearch: false, temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { maxTokens: opts.maxTokens } : {}),
      ...(opts.jsonMode ? { jsonMode: true } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Sağlayıcı hatası (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ""; let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const j = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] };
        const d = j.choices?.[0]?.delta?.content ?? "";
        if (d) { full += d; opts.onDelta?.(full); }
      } catch { /* parçalı satır */ }
    }
  }
  return full;
}

/** Yanıttan ilk dengeli { } JSON bloğunu ayıklar (```json çitleri desteklenir). */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  if (start === -1) throw new Error("JSON bulunamadı — tekrar dene.");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("JSON tamamlanmamış — tekrar dene.");
}
