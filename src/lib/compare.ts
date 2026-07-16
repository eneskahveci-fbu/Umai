import type { CompareResult } from "./types";

/* Karşılaştırma görünümü — aynı mesajı birden fazla modelle PARALEL çalıştırıp
   sonuçları yan yana gösterir. Fusion'dan farklı: sentezlemez/hakem kullanmaz —
   kullanıcı hangi yanıtı tutacağını kendi seçer (bkz. MessageBubble "Bunu
   kullan"). Model seçimi Fusion'la AYNI sezgiyi (pickDraftModels/
   fillSelfConsistency) kullanır — burada tekrarlanmaz. */

interface CompareCandidate {
  label: string;
  baseUrl: string;
  model: string;
  provider: string;
  apiKey: string;
}

/* Tek bir modelden tam (akışsız) yanıt toplar — draftOnce ile aynı SSE
   ayrıştırma mantığı, ama kısaltma YOK (karşılaştırmada kullanıcı tam yanıtı
   görmeli, iç taslak değil). */
async function compareOnce(c: CompareCandidate, userText: string, signal: AbortSignal): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: [{ role: "user", content: userText }],
      baseUrl: c.baseUrl, model: c.model, apiKey: c.apiKey, provider: c.provider,
      tools: false, webSearch: false,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
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
        full += j.choices?.[0]?.delta?.content ?? "";
      } catch { /* parça — yoksay */ }
    }
  }
  return full.trim();
}

/** Adayları paralel çalıştırır; her biri 60 sn ile sınırlı. Başarısız olan
    bir aday listeden düşmez — `error` alanıyla o sütunda gösterilir, diğer
    sütunları etkilemez (Promise.allSettled). */
export async function runCompare(opts: {
  userText: string;
  candidates: CompareCandidate[];
  signal?: AbortSignal;
}): Promise<CompareResult[]> {
  const attempt = async (c: CompareCandidate): Promise<CompareResult> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60_000);
    opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
    try {
      const content = await compareOnce(c, opts.userText, ctrl.signal);
      return { label: c.label, content };
    } catch (e) {
      return { label: c.label, content: "", error: (e as Error).message || "İstek başarısız" };
    } finally {
      clearTimeout(t);
    }
  };
  return Promise.all(opts.candidates.map(attempt));
}
