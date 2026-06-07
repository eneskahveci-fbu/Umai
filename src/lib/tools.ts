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
      description: "Bağlı repodaki tüm dosyaların yollarını listeler. Filtre ile daralt.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Dosya yolunda aranacak alt-string (opsiyonel). Örn: 'components' veya '.tsx'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Bağlı repodan bir dosyanın içeriğini okur. Dosya yolu repo köküne göre relatif olmalı.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repo köküne göre dosya yolu. Örn: 'src/components/Button.tsx'" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Dosya adlarında anahtar kelime arar (içerik değil, yol arar).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin (dosya yolunda)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Dosya İÇERİKLERinde kod veya metin arar. Belirli bir fonksiyon, değişken veya pattern aramak için kullan.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak kod/metin. Örn: 'useState', 'async function', 'TODO:'" },
          extension: { type: "string", description: "Uzantı filtresi (opsiyonel). Örn: 'ts', 'tsx', 'py'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Repoya yeni bir dosya yazar veya var olan dosyayı günceller. Kodu yazdıktan sonra commit eder.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Dosya yolu. Örn: 'src/utils/helper.ts'" },
          content: { type: "string", description: "Dosyanın tam içeriği" },
          commit_message: { type: "string", description: "Commit mesajı. Örn: 'feat: add helper utility'" },
        },
        required: ["path", "content", "commit_message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_branches",
      description: "Repodaki dalları (branch) listeler.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_branch",
      description: "Mevcut bir daldan yeni bir dal (branch) oluşturur.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Yeni dal adı. Örn: 'feature/login-page'" },
          from: { type: "string", description: "Kaynak dal adı. Belirtilmezse aktif dal kullanılır." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_commit_history",
      description: "Repodaki son commit'leri listeler.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "string", description: "Kaç commit gösterilsin (varsayılan 10, max 30)" },
          path: { type: "string", description: "Sadece belirli dosyayı etkileyen commit'ler (opsiyonel)" },
        },
        required: [],
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
