/**
 * Coder modundaki AI ajanın kullanabileceği araç tanımları.
 * OpenAI function-calling / tool-use formatında.
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const CODER_TOOLS: ToolDefinition[] = [
  // ── Dosya Okuma ──
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Bağlı repodaki tüm dosyaların yollarını listeler. Filtre ile daralt.",
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
      description: "Bağlı repodan bir dosyanın içeriğini okur. İçerik SATIR NUMARALARIYLA döner.",
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
      name: "read_files",
      description: "Birden çok dosyayı TEK çağrıda okur (satır numaralı). Bağımsız dosyaları ayrı ayrı okumak yerine bunu kullan.",
      parameters: {
        type: "object",
        properties: {
          paths: {
            type: "array",
            items: { type: "string" },
            description: "Okunacak dosya yolları dizisi (en çok 10)",
          },
        },
        required: ["paths"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Yıldızlı desenle dosya bulur. '*' tek segment, çift-yıldız dizinler arası.",
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
  },

  // ── Arama ──
  {
    type: "function",
    function: {
      name: "grep",
      description: "REGEX ile dosya İÇERİKLERİnde arar; 'dosya:satır: eşleşen satır' döndürür.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Aranacak regex. Örn: 'function\\\\s+\\\\w+'",
          },
          glob: {
            type: "string",
            description: "Aramayı sınırlayan dosya deseni (opsiyonel). Örn: 'src/**/*.ts'",
          },
          ignore_case: {
            type: "boolean",
            description: "Büyük/küçük harf duyarsız (opsiyonel)",
          },
        },
        required: ["pattern"],
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
          query: {
            type: "string",
            description: "Aranacak metin (dosya yolunda)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Dosya İÇERİKLERİnde kod veya metin arar.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Aranacak kod/metin. Örn: 'useState', 'async function', 'TODO:'",
          },
          extension: {
            type: "string",
            description: "Uzantı filtresi (opsiyonel). Örn: 'ts', 'tsx', 'py'",
          },
        },
        required: ["query"],
      },
    },
  },

  // ── Dosya Yazma/Değiştirme ──
  {
    type: "function",
    function: {
      name: "write_file",
      description: "YENİ dosya oluşturur veya bir dosyayı TAMAMEN değiştirir. Var olan dosyada KÜÇÜK değişiklik yapacaksan str_replace kullan. Yazdıktan sonra commit eder.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Dosya yolu. Örn: 'src/utils/helper.ts'",
          },
          content: {
            type: "string",
            description: "Dosyanın tam içeriği",
          },
          commit_message: {
            type: "string",
            description: "Commit mesajı. Örn: 'feat: add helper utility'",
          },
        },
        required: ["path", "content", "commit_message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "str_replace",
      description: "Var olan bir dosyada HEDEFLİ düzenleme: old_string'i new_string ile değiştirir. old_string dosyada BENZERSİZ ve birebir eşleşmeli. Değişiklik commit edilir.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repo köküne göre dosya yolu",
          },
          old_string: {
            type: "string",
            description: "Değiştirilecek MEVCUT metin — ham kod (satır numarası OLMADAN), girinti dahil birebir",
          },
          new_string: {
            type: "string",
            description: "Yerine yazılacak yeni metin",
          },
          commit_message: {
            type: "string",
            description: "Commit mesajı (opsiyonel)",
          },
          replace_all: {
            type: "boolean",
            description: "true ise tüm eşleşmeleri değiştirir (opsiyonel, varsayılan false)",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Bir dosyanın SİLİNMESİNİ ÖNERİR. Doğrudan silmez — kullanıcıya onay olarak sunulur. Yıkıcı işlem!",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Silinecek dosya yolu",
          },
          reason: {
            type: "string",
            description: "Neden (onay ekranında görünür)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Bir dosyanın YENİDEN ADLANDIRILMASINI/TAŞINMASINI ÖNERİR. Doğrudan yapmaz — kullanıcı onayına sunulur.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Mevcut dosya yolu",
          },
          new_path: {
            type: "string",
            description: "Yeni dosya yolu",
          },
          reason: {
            type: "string",
            description: "Neden (opsiyonel)",
          },
        },
        required: ["path", "new_path"],
      },
    },
  },

  // ── Git ──
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
          name: {
            type: "string",
            description: "Yeni dal adı. Örn: 'feature/login-page'",
          },
          from: {
            type: "string",
            description: "Kaynak dal adı. Belirtilmezse aktif dal kullanılır.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pr",
      description: "head dalından base dalına bir Pull Request / Merge Request açar. Başlık ve açıklamayı sen üret.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "PR/MR başlığı",
          },
          head: {
            type: "string",
            description: "Kaynak dal (değişikliklerin olduğu)",
          },
          base: {
            type: "string",
            description: "Hedef dal (genelde ana dal)",
          },
          body: {
            type: "string",
            description: "PR/MR açıklaması (markdown, opsiyonel)",
          },
        },
        required: ["title", "head", "base"],
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
          limit: {
            type: "string",
            description: "Kaç commit gösterilsin (varsayılan 10, max 30)",
          },
          path: {
            type: "string",
            description: "Sadece belirli dosyayı etkileyen commit'ler (opsiyonel)",
          },
        },
        required: [],
      },
    },
  },

  // ── Orkestrasyon ──
  {
    type: "function",
    function: {
      name: "dispatch_agents",
      description: "Karmaşık bir görevi PARALEL alt-ajanlara böler. Her alt-ajan repoyu salt-okunur araçlarla BAĞIMSIZ inceler ve sonucunu döndürür.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, instruction: { type: "string" } } },
            description: "Alt görevler dizisi (2-4 adet, bağımsız)",
          },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "Çok adımlı bir görev için canlı yapılacaklar listesini (plan) günceller. '[ ]' bekliyor, '[~]' devam ediyor, '[x]' tamamlandı.",
      parameters: {
        type: "object",
        properties: {
          plan: {
            type: "string",
            description: "Her satırda bir adım: '[ ]' / '[~]' / '[x]' durum işaretiyle başlar",
          },
        },
        required: ["plan"],
      },
    },
  },
];

/**
 * Web arama aracı (isteğe bağlı olarak eklenir).
 */
export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "İnternette arama yapar. Güncel bilgi gerektiğinde kullan.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Arama sorgusu",
        },
      },
      required: ["query"],
    },
  },
};
