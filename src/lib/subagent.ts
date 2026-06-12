import type { ChatMessage, ToolDef } from "@/lib/types";

interface SubagentOptions {
  instruction: string;
  repoFiles: { path: string; content: string }[];
  tools?: ToolDef[];
  baseUrl: string;
  model: string;
  apiKey: string;
  provider?: string;
}

interface SubagentResult {
  title: string;
  result: string;
  error?: string;
}

/**
 * Salt-okunur bir alt-ajan çalıştırır.
 * Yalnızca repodaki dosyaları okuyabilir, değişiklik YAPAMAZ.
 * dispatch_agents() pattern'ini Claude Code tarzı uygular.
 */
export async function runReadOnlyAgent(opts: SubagentOptions): Promise<SubagentResult> {
  const { instruction, repoFiles, tools, baseUrl, model, apiKey, provider } = opts;

  const fileList = repoFiles
    .map((f) => `- ${f.path} (${f.content.length} karakter)`)
    .join("\n");

  const systemPrompt = `Sen salt-okunur bir kod analiz alt-ajanısın. 
Görevin: ${instruction}

Kullanabileceğin repo dosyaları:
${fileList || "(repo boş)"}

YANITINI YALNIZCA düz metin olarak ver. Markdown formatında yazabilirsin.
Dosyaları değiştiremezsin, commit yapamazsın, PR açamazsın. Yalnızca analiz yap.`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Dosya içeriklerini context'e ekle (token limitine dikkat)
  const MAX_FILE_CONTEXT = 40_000;
  let totalChars = 0;
  for (const file of repoFiles) {
    if (totalChars > MAX_FILE_CONTEXT) break;
    const snippet = file.content.slice(0, 10_000);
    totalChars += snippet.length;
    messages.push({
      role: "user",
      content: `Dosya: ${file.path}\n\`\`\`\n${snippet}\n\`\`\``,
    });
  }

  messages.push({ role: "user", content: instruction });

  // Tool definitions varsa ekle
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    headers["x-api-key"] = apiKey;
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        title: instruction.slice(0, 80),
        result: "",
        error: `${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";

    return {
      title: instruction.slice(0, 80),
      result: text,
    };
  } catch (e) {
    return {
      title: instruction.slice(0, 80),
      result: "",
      error: (e as Error).message,
    };
  }
}
