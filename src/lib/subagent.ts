/**
 * Alt-ajan (sub-agent) yönetimi.
 * salt-okunur ajan çalıştırma ve çoklu-ajan orkestrasyonu.
 */

interface SubagentOptions {
  instruction: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: number;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  repoToken?: string;
  repoProvider?: "github" | "gitlab";
}

interface SubagentResult {
  result: string;
  toolCalls: number;
}

/**
 * Salt-okunur bir alt-ajan çalıştırır (araç çağrıları yapabilir ama yazma yapmaz).
 */
export async function runReadOnlyAgent(
  opts: SubagentOptions,
): Promise<SubagentResult> {
  const {
    instruction,
    model = "gpt-4o",
    baseUrl = "https://api.openai.com/v1",
    apiKey = process.env.OPENAI_API_KEY || "",
    maxTokens = 16_000,
  } = opts;

  const messages = [
    {
      role: "system" as const,
      content: `Sen salt-okunur bir kod analiz asistanısın. Verilen görevi yap, dosyaları okuyabilirsin ama DEĞİŞİKLİK YAPMA. Sonucu kısa ve net döndür.`,
    },
    { role: "user" as const, content: instruction },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Subagent API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  return {
    result: data.choices?.[0]?.message?.content || "",
    toolCalls: 0,
  };
}

// ── Orchestrate ──

export interface AgentTask {
  id: string;
  title: string;
  instruction: string;
}

export interface OrchestratePlan {
  tasks: AgentTask[];
  reasoning: string;
}

/**
 * Karmaşık bir görevi alt görevlere bölen plan oluşturur.
 */
export async function buildPlan(
  userMessage: string,
  context: string,
  baseUrl: string,
  model: string,
  apiKey: string,
): Promise<OrchestratePlan> {
  // Basit: görevi talimatlara göre böl
  const tasks: AgentTask[] = [];
  const keywords = userMessage.toLowerCase();

  if (keywords.includes("incele") || keywords.includes("analiz") || keywords.includes("bak")) {
    tasks.push({
      id: "inspect",
      title: "Kod İnceleme",
      instruction: `Kod tabanını incele: ${userMessage}. ${context}`,
    });
  }

  if (keywords.includes("düzelt") || keywords.includes("fix") || keywords.includes("bug") || keywords.includes("hata")) {
    tasks.push({
      id: "fix",
      title: "Hata Düzeltme",
      instruction: `Hataları bul ve düzeltme önerileri sun: ${userMessage}. ${context}`,
    });
  }

  if (keywords.includes("test")) {
    tasks.push({
      id: "test",
      title: "Test Yazma",
      instruction: `Test yaz: ${userMessage}. ${context}`,
    });
  }

  if (keywords.includes("refactor") || keywords.includes("düzenle") || keywords.includes("temizle")) {
    tasks.push({
      id: "refactor",
      title: "Refactor",
      instruction: `Kodu yeniden düzenle: ${userMessage}. ${context}`,
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: "general",
      title: "Genel Görev",
      instruction: `${userMessage}. ${context}`,
    });
  }

  return { tasks, reasoning: `${tasks.length} alt göreve bölündü` };
}

/**
 * Birden çok alt-ajanı paralel çalıştırır.
 */
export async function runParallelAgents(
  tasks: AgentTask[],
  baseUrl: string,
  model: string,
  apiKey: string,
): Promise<{ taskId: string; result: string }[]> {
  const promises = tasks.map(async (task) => {
    try {
      const r = await runReadOnlyAgent({
        instruction: task.instruction,
        model,
        baseUrl,
        apiKey,
      });
      return { taskId: task.id, result: r.result };
    } catch (e) {
      return { taskId: task.id, result: `Hata: ${e instanceof Error ? e.message : String(e)}` };
    }
  });

  return Promise.all(promises);
}

/**
 * Paralel ajan sonuçlarını birleştirip final yanıt üretir.
 */
export async function synthesizeResults(
  results: { taskId: string; result: string }[],
  originalMessage: string,
  baseUrl: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const combined = results
    .map((r) => `### ${r.taskId}\n${r.result}`)
    .join("\n\n");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Sen bir sonuç birleştiricisin. Verilen paralel analiz sonuçlarını birleştir, tutarlı ve kapsamlı bir final yanıt üret. Türkçe yanıt ver.",
        },
        {
          role: "user",
          content: `Orijinal soru: ${originalMessage}\n\nParalel sonuçlar:\n${combined}\n\nTüm bu sonuçları birleştirip kapsamlı bir final yanıt üret.`,
        },
      ],
      max_tokens: 32_000,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    return combined; // Fallback: birleştirilmiş ham sonuç
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices?.[0]?.message?.content || combined;
}
