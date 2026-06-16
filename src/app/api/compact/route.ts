import type { NextRequest } from "next/server";
import { checkLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Otomatik bağlam sıkıştırma: uzun sohbette ESKİ mesajları tek bir özete damıtır
   (Claude Code'daki /compact gibi). /api/memory ile aynı sözleşme: anahtar
   istemciden gelir, sunucuda saklanmaz. Hata durumunda boş döner — ana akışı
   asla bozmaz (istemci ham kırpmaya düşer). */
export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "compact", 10, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const { transcript, baseUrl, model, apiKey } = await req.json();
  if (!baseUrl || !model || !apiKey || !transcript) {
    return Response.json({ summary: "" });
  }

  const messages = [
    {
      role: "system",
      content:
        "Sen bir sohbet özetleyicisin. Aşağıdaki konuşmayı; alınan kararları, üzerinde " +
        "çalışılan konuyu/dosyaları, yapılan değişiklikleri ve çözülmemiş sorunları KORUYARAK, " +
        "en fazla 250 kelimeyle özetle. Sonraki yanıtların bağlamı kaybetmemesi için kritik " +
        "ayrıntıları (dosya yolları, kararlar, TODO'lar) madde madde tut. SADECE özeti yaz.",
    },
    { role: "user", content: String(transcript).slice(0, 24000) },
  ];

  try {
    const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 500, stream: false }),
    });
    if (!res.ok) return Response.json({ summary: "" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return Response.json({ summary: "" });
    const data = await res.json().catch(() => null);
    const summary: string = data?.choices?.[0]?.message?.content || "";
    return Response.json({ summary: summary.trim() });
  } catch {
    return Response.json({ summary: "" });
  }
}
