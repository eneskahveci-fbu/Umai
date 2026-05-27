export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages, baseUrl, model, apiKey } = await req.json();
  if (!baseUrl || !model || !apiKey || !messages?.length) {
    return Response.json({ suggestions: [] });
  }

  const last4 = messages.slice(-4);
  const suggestMessages = [
    {
      role: "system",
      content:
        "Konuşmaya dayanarak kullanıcının sorabileceği 3 kısa takip sorusu öner. " +
        "YALNIZCA soruları yaz, her biri ayrı satırda, numarasız ve madde işaretsiz.",
    },
    ...last4,
  ];

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: suggestMessages,
        max_tokens: 200,
        stream: false,
      }),
    });
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    const suggestions = text
      .split("\n")
      .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
      .filter((l) => l.length > 5 && l.length < 120)
      .slice(0, 3);
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
