export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export const CODER_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "Bağlı GitHub deposundaki tüm dosyaların yollarını listeler. Çok sayıda dosya varsa filtre ile daralt.",
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
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Bağlı GitHub deposundan belirli bir dosyanın içeriğini okur. " +
        "Dosya yolu repo köküne göre relatif olmalı.",
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
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description:
        "Dosya isimlerinde anahtar kelime arar. İçeriği değil sadece dosya yollarını arar.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin (dosya yolunda)" },
        },
        required: ["query"],
      },
    },
  },
];

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}
