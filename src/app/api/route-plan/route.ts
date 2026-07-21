import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";
import { parseBody, llmProxySchema } from "@/lib/apiSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Otomatik Pilot yönlendirme kararı (LLM-tabanlı) — "görünmez zeka"nın
   efor/kalite/füzyon kısmı artık sabit regex yerine hızlı bir model çağrısına
   dayanır (bkz. src/lib/autoPilot.ts'in decidePilotAsync'i). web/research/
   swarm hâlâ regex'te kalır (bkz. autoPilot.ts yorumu — organik araç kararları,
   ön-uçta sınıflandırılacak bir şey değil). /api/compact ile aynı sözleşme:
   anahtar istemciden gelir, sunucuda saklanmaz; hata durumunda boş döner —
   çağıran taraf (autoPilot.ts) senkron regex yedeğine düşer. */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "route-plan", 20, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const __v = await parseBody(req, llmProxySchema);
  if (!__v.ok) return __v.res;
  const { text, hasRepo, baseUrl, model, apiKey } = __v.data as {
    text?: string; hasRepo?: boolean; baseUrl?: string; model?: string; apiKey?: string;
  };
  if (!baseUrl || !model || !text) return Response.json({});

  const messages = [
    {
      role: "system",
      content:
        "Sen bir yönlendirme sınıflandırıcısısın. Kullanıcının mesajına bakarak 3 karar ver ve YALNIZCA " +
        "şu JSON ile yanıt ver, başka hiçbir şey yazma:\n" +
        '{"effort":"low|medium|high|max","quality":true|false,"fusion":true|false}\n\n' +
        "effort: mesaj kısa/basitse 'low', normalse 'medium', kod/mimari/güvenlik/refactor gibi ağır bir " +
        "iş isteniyorsa 'high', kullanıcı açıkça 'kapsamlı/derinlemesine/baştan yaz' gibi çok kapsamlı bir " +
        "şey istiyorsa 'max'.\n" +
        "quality: kullanıcı özenli/uzun bir rapor, makale, doküman, tasarım ya da strateji istiyorsa true.\n" +
        "fusion: kullanıcı YALNIZCA bir SİTE/UYGULAMA/ARAYÜZ/KOD ÜRETİLMESİNİ istiyorsa (ör. 'bir landing " +
        "sayfası tasarla', 'bir React bileşeni yaz') true; sıradan sohbet/soru/hata ayıklamada false.",
    },
    { role: "user", content: `Repo bağlı: ${hasRepo ? "evet" : "hayır"}\nMesaj:\n${String(text).slice(0, 2000)}` },
  ];

  try {
    const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey || ""}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 60, stream: false }),
    });
    if (!res.ok) return Response.json({});
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return Response.json({});
    const data = await res.json().catch(() => null);
    const raw: string = data?.choices?.[0]?.message?.content || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return Response.json({});
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { effort?: unknown; quality?: unknown; fusion?: unknown };
    const effort = typeof parsed.effort === "string" && ["low", "medium", "high", "max"].includes(parsed.effort)
      ? parsed.effort
      : undefined;
    if (!effort) return Response.json({});
    return Response.json({ effort, quality: !!parsed.quality, fusion: !!parsed.fusion });
  } catch {
    return Response.json({});
  }
}
