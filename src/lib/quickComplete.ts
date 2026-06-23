import { useStore } from "./store";
import { buildFallbackChain } from "./fallback";
import { decryptField, isEncrypted } from "./secureKeys";

/* Aktif modelle tek-seferlik (araçsız) bir tamamlanma çağrısı yapar ve TÜM metni
   döndürür. İstem geliştirici / özel stil türetme gibi küçük yardımcı işler için.
   /api/chat akışını (SSE) okur; çoklu-sağlayıcı fallback zincirini kullanır. */
export async function quickComplete(prompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
  const store = useStore.getState();
  const active = store.activeModel();
  if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
  /* Anahtar: model veya sağlayıcı-anahtarı; şifreliyse çöz. */
  let apiKey = active.apiKey || (store.config.providerKeys as Record<string, string> | undefined)?.[active.provider] || "";
  if (apiKey) {
    apiKey = await decryptField(apiKey);
    if (isEncrypted(apiKey)) apiKey = "";
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
      systemPrompt,
      fallbacks: buildFallbackChain(store.config.models, store.config.activeModelId),
      tools: false, webSearch: false, temperature: 0.6,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);

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
        if (d) full += d;
      } catch { /* yok say */ }
    }
  }
  return full.trim();
}
