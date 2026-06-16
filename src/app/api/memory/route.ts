import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";
import { parseBody, llmProxySchema } from "@/lib/apiSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Otomatik bellek damıtma: son kullanıcı+asistan alışverişinden GELECEK
   sohbetlerde işe yarayacak kalıcı bilgileri (tercih, stil, proje bağlamı)
   çıkarır. /api/suggest ile aynı sözleşme: anahtar istemciden gelir,
   sunucuda saklanmaz. Hata durumunda sessizce boş döner — bellek
   çıkarımı asla ana akışı bozmamalı. */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "memory", 15, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const __v = await parseBody(req, llmProxySchema);
  if (!__v.ok) return __v.res;
  const { userText, assistantText, existing, baseUrl, model, apiKey } = __v.data as {
    userText?: string; assistantText?: string; existing?: string; baseUrl?: string; model?: string; apiKey?: string;
  };
  if (!baseUrl || !model || !apiKey || !userText) {
    return Response.json({ facts: [] });
  }

  const messages = [
    {
      role: "system",
      content:
        "Kullanıcı ile asistan arasındaki son alışverişten, GELECEK sohbetlerde işe yarayacak " +
        "KALICI bilgileri çıkar: teknoloji/araç tercihleri, kod stili kuralları, proje bağlamı, " +
        "dil tercihi, tekrar eden istekler. Geçici görev ayrıntılarını, tek seferlik soruları ve " +
        "zaten bilinenleri ALMA. Her bilgi tek satır, kısa ve Türkçe olsun; EN FAZLA 3 satır yaz. " +
        "Kalıcı hiçbir şey yoksa yalnızca YOK yaz.",
    },
    {
      role: "user",
      content:
        (existing ? `ZATEN BİLİNENLER:\n${String(existing).slice(0, 3000)}\n\n` : "") +
        `KULLANICI:\n${String(userText).slice(0, 4000)}\n\n` +
        `ASİSTAN:\n${String(assistantText ?? "").slice(0, 4000)}`,
    },
  ];

  try {
    const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 200, stream: false }),
    });
    if (!res.ok) return Response.json({ facts: [] });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return Response.json({ facts: [] });
    const data = await res.json().catch(() => null);
    const text: string = data?.choices?.[0]?.message?.content || "";
    if (/^\s*YOK\s*$/i.test(text)) return Response.json({ facts: [] });
    const facts = text
      .split("\n")
      .map((l) => l.replace(/^[\d.)\s•*-]+/, "").trim())
      .filter((l) => l.length > 4 && l.length < 200 && !/^YOK$/i.test(l))
      .slice(0, 3);
    return Response.json({ facts });
  } catch {
    return Response.json({ facts: [] });
  }
}
