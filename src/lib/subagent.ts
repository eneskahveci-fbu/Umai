// src/lib/subagent.ts — Çoklu-ajan orkestrasyonu (Claude Code tarzı)

import type { SubAgentTask, SubAgentResult } from "./types";

interface SubAgentContext {
  modelId: string;
  apiKey: string;
  baseURL: string;
  projectContext?: string;
  platformKnowledge?: string;
}

async function runSingleSubAgent(
  task: SubAgentTask,
  ctx: SubAgentContext,
): Promise<SubAgentResult> {
  const systemPrompt = `Sen bir alt-ajansın. Görevin: ${task.title}
Yalnızca aşağıdaki talimatı yerine getir, başka şey yapma.
Kod tabanını analiz et, dosyaları oku, sonucu kapsamlı ve yapılandırılmış olarak döndür.

${ctx.platformKnowledge ?? ""}
${ctx.projectContext ? `\n[Proje bağlamı]:\n${ctx.projectContext}` : ""}`;

  const response = await fetch(`${ctx.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.apiKey}`,
    },
    body: JSON.stringify({
      model: ctx.modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: task.instruction },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { title: task.title, result: "", error: `API hatası: ${errText}` };
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";

  return { title: task.title, result: content };
}

// Paralel alt-ajanları çalıştır
export async function dispatchSubAgents(
  tasks: SubAgentTask[],
  ctx: SubAgentContext,
): Promise<SubAgentResult[]> {
  if (tasks.length === 0) return [];

  const results = await Promise.allSettled(
    tasks.map((task) => runSingleSubAgent(task, ctx)),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      title: tasks[i].title,
      result: "",
      error: r.reason?.message ?? "Bilinmeyen hata",
    };
  });
}

// Sonuçları birleştirip özet üret
export function mergeSubAgentResults(
  results: SubAgentResult[],
): string {
  const parts: string[] = ["## Alt-ajan Sonuçları\n"];

  for (const r of results) {
    parts.push(`### ${r.title}`);
    if (r.error) {
      parts.push(`❌ Hata: ${r.error}`);
    } else {
      parts.push(r.result);
    }
    parts.push("");
  }

  return parts.join("\n");
}
