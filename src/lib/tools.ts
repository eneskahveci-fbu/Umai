import type { ToolDef } from "@/lib/types";

export const CODER_TOOLS: ToolDef[] = [
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
      description:
        "Bağlı repodan bir dosyanın içeriğini okur. İçerik SATIR NUMARALARIYLA döner (referans için).",
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
      description:
        "Birden çok dosyayı TEK çağrıda okur (satır numaralı). Bağımsız dosyaları ayrı ayrı read_file ile çağırmak yerine bunu kullan — daha hızlı.",
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
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Yıldızlı desenle dosya bulur. '*' tek segment, çift-yıldız dizinler arası, '?' tek karakter.",
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
  {
    type: "function",
    function: {
      name: "grep",
      description:
        "REGEX ile dosya İÇERİKLERİnde arar; 'dosya:satır: eşleşen satır' döndürür. 'glob' ile kapsamı daralt.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Aranacak regex. Örn: 'function\\s+\\w+', 'TODO'",
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
      description:
        "Dosya İÇERİKLERİNDE kod veya metin arar. Belirli bir fonksiyon, değişken veya pattern aramak için kullan.",
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
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "YENİ dosya oluşturur veya bir dosyayı TAMAMEN değiştirir (tüm içerik). Var olan bir dosyada KÜÇÜK değişiklik yapacaksan write_file yerine str_replace kullan — daha hızlı ve ucuz.",
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
      description:
        "Var olan bir dosyada HEDEFLİ düzenleme: old_string'i new_string ile değiştirir. old_string dosyada BENZERSİZ ve birebir eşleşmeli.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repo köküne göre dosya yolu",
          },
          old_string: {
            type: "string",
            description:
              "Değiştirilecek MEVCUT metin — ham kod (satır numarası OLMADAN), girinti dahil birebir",
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
            description:
              "true ise tüm eşleşmeleri değiştirir (opsiyonel, varsayılan false)",
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
      description:
        "Bir dosyanın SİLİNMESİNİ ÖNERİR. Doğrudan silmez — kullanıcıya onay olarak sunulur. Yıkıcı işlem olduğu için yalnızca gerçekten gerektiğinde kullan.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Silinecek dosyanın repo köküne göre yolu",
          },
          reason: {
            type: "string",
            description:
              "Neden silinmeli (kullanıcının onay ekranında görünür)",
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
      description:
        "Bir dosyanın YENİDEN ADLANDIRILMASINI/TAŞINMASINI ÖNERİR. Doğrudan yapmaz — kullanıcı onayına sunulur.",
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
            description: "Neden (opsiyonel, onay ekranında görünür)",
          },
        },
        required: ["path", "new_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_agents",
      description:
        "Karmaşık bir görevi PARALEL alt-ajanlara böler (Claude'daki Task/subagent gibi). Yalnızca birbirinden bağımsız 2-4 alt görev için kullan.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            description:
              "Alt görevler dizisi: [{title, instruction}] (2-4 adet, bağımsız)",
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
      description:
        "Çok adımlı bir görev için canlı yapılacaklar listesini (plan) günceller. Her satır bir adım: '[ ]' bekliyor, '[~]' devam ediyor, '[x]' tamamlandı.",
      parameters: {
        type: "object",
        properties: {
          plan: {
            type: "string",
            description:
              "Her satırda bir adım: '[ ]' / '[~]' / '[x]' durum işaretiyle başlar",
          },
        },
        required: ["plan"],
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
          name: {
            type: "string",
            description: "Yeni dal adı. Örn: 'feature/login-page'",
          },
          from: {
            type: "string",
            description:
              "Kaynak dal adı. Belirtilmezse aktif dal kullanılır.",
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
      description:
        "head dalından base dalına bir Pull Request (GitHub) / Merge Request (GitLab) açar. Başlık ve açıklamayı sen üret.",
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
            description:
              "Sadece belirli dosyayı etkileyen commit'ler (opsiyonel)",
          },
        },
        required: [],
      },
    },
  },
];
