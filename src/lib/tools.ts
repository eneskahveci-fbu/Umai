// src/lib/tools.ts — AI tool-use yönetimi (Claude Code tarzı araçlar)

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

//─────── Araç tanımları (LLM'ye gönderilecek) ───────
export function getAvailableTools(): ToolDefinition[] {
  return [
    {
      name: "list_files",
      description:
        "Bağlı repodaki tüm dosyaların yollarını listeler. Filtre ile daralt.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            description: "Dosya yolunda aranacak alt-string (opsiyonel). Örn: 'components' veya '.tsx'",
          },
        },
        required: [],
      },
    },
    {
      name: "read_file",
      description:
        "Bağlı repodan bir dosyanın içeriğini okur. İçerik SATIR NUMARALARIYLA döner.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repo köküne göre dosya yolu. Örn: 'src/components/Button.tsx'",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "read_files",
      description: "Birden çok dosyayı TEK çağrıda okur (satır numaralı).",
      parameters: {
        type: "object",
        properties: {
          paths: {
            type: "array",
            description: "Okunacak dosya yolları dizisi (en çok 10)",
          },
        },
        required: ["paths"],
      },
    },
    {
      name: "glob",
      description: "Yıldızlı desenle dosya bulur.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob deseni. Örn: 'src/**/*.ts'",
          },
        },
        required: ["pattern"],
      },
    },
    {
      name: "grep",
      description: "REGEX ile dosya İÇERİKLERİnde arar.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Aranacak regex" },
          glob: { type: "string", description: "Dosya deseni (opsiyonel)" },
          ignore_case: { type: "boolean", description: "Büyük/küçük harf duyarsız" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "search_code",
      description: "Dosya İÇERİKLERİnde basit metin arar.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin" },
          extension: { type: "string", description: "Uzantı filtresi (opsiyonel)" },
        },
        required: ["query"],
      },
    },
    {
      name: "write_file",
      description: "YENİ dosya oluşturur veya bir dosyayı TAMAMEN değiştirir.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Dosya yolu" },
          content: { type: "string", description: "Dosyanın tam içeriği" },
          commit_message: { type: "string", description: "Commit mesajı" },
        },
        required: ["path", "content", "commit_message"],
      },
    },
    {
      name: "str_replace",
      description: "Var olan bir dosyada HEDEFLİ düzenleme.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Dosya yolu" },
          old_string: { type: "string", description: "Değiştirilecek MEVCUT metin" },
          new_string: { type: "string", description: "Yeni metin" },
          commit_message: { type: "string", description: "Commit mesajı (opsiyonel)" },
          replace_all: { type: "boolean", description: "Tüm eşleşmeleri değiştir" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  ];
}

// LLM yanıtındaki tool_call'leri ayıkla
export function parseToolCalls(
  content: string,
): { text: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  const regex =
    /<invoke name="([^"]+)">\s*([\s\S]*?)\s*<\/invoke>/g;

  let match: RegExpExecArray | null;
  let cleanedContent = content;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const rawParams = match[2];

    const args: Record<string, unknown> = {};
    const paramRegex =
      /<parameter name="([^"]+)"(?: string="([^"]*)")?>([\s\S]*?)<\/parameter>/g;
    let paramMatch: RegExpExecArray | null;

    while ((paramMatch = paramRegex.exec(rawParams)) !== null) {
      const pName = paramMatch[1];
      const isString = paramMatch[2] === "true";
      let pValue: unknown = paramMatch[3].trim();

      if (isString) {
        args[pName] = pValue;
      } else {
        try {
          args[pName] = JSON.parse(pValue as string);
        } catch {
          args[pName] = pValue;
        }
      }
    }

    toolCalls.push({
      id: `call_${Date.now()}_${toolCalls.length}`,
      name,
      arguments: args,
    });

    cleanedContent = cleanedContent.replace(match[0], "");
  }

  return { text: cleanedContent.trim(), toolCalls };
}

// Tool sonuçlarını formatla
export function formatToolResults(results: ToolResult[]): string {
  return results
    .map((r) => `<result id="${r.tool_call_id}">\n${r.content}\n</result>`)
    .join("\n\n");
}
