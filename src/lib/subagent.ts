// ── Salt-okunur alt ajan (dispatch_agents implementasyonu) ──

import type { ChatMessage } from "./types";
import { buildContextSections } from "./prompt";

interface AgentTask {
  title: string;
  instruction: string;
}

interface AgentResult {
  title: string;
  result: string;
  error?: string;
}

interface SubagentOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  systemPrompt?: string;
}

/**
 * Birden çok salt-okunur alt ajanı paralel çalıştırır.
 * Her alt ajan tek bir mesaj alır, metin yanıtı döner.
 */
export async function runReadOnlyAgents(
  tasks: AgentTask[],
  opts: SubagentOptions,
): Promise<AgentResult[]> {
  const results = await Promise.allSettled(
    tasks.map(async (task): Promise<AgentResult> => {
      const systemPrompt = buildContextSections({
        systemPrompt: opts.systemPrompt,
      });

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Görev: ${task.title}\n\n${task.instruction}\n\nBu görevi tamamla. Yalnızca salt-okunur araçları (list_files, read_file, glob, grep, search_files, search_code) kullanabilirsin. Yanıtını Türkçe ve markdown formatında, kod bloklarını dil belirterek ver.`,
        },
      ];

      const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Agent API error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
      };

      return {
        title: task.title,
        result: data.choices?.[0]?.message?.content ?? "(boş yanıt)",
      };
    }),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      title: tasks[i]?.title ?? "unknown",
      result: "",
      error: r.reason?.message ?? "Bilinmeyen hata",
    };
  });
}

/**
 * Tek bir salt-okunur ajan çalıştırır (uyumlu wrapper).
 */
export async function runReadOnlyAgent(
  task: AgentTask,
  opts: SubagentOptions,
): Promise<AgentResult> {
  const results = await runReadOnlyAgents([task], opts);
  return results[0]!;
}
