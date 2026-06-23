/* Araç parametre şeması. İç-içe array/object alanları (ör. ask_user soruları)
   desteklemek için basit string alanların yanında genişletilmiş biçimleri de kabul eder. */
export type ToolPropertySchema =
  | { type: string; description: string; enum?: string[] }
  | { type: "array"; description: string; items?: object }
  | { type: "object"; description: string; properties?: Record<string, unknown>; required?: string[] };

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolPropertySchema>;
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
      description: "Bağlı repodan bir dosyanın içeriğini okur. İçerik SATIR NUMARALARIYLA döner (referans için). Not: str_replace'te old_string olarak satır numarasını DEĞİL, ham kod metnini kullan. Dosya yolu repo köküne göre relatif olmalı.",
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
      name: "read_files",
      description: "Birden çok dosyayı TEK çağrıda okur (satır numaralı). Bağımsız dosyaları ayrı ayrı read_file ile çağırmak yerine bunu kullan — daha hızlı.",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", description: "Okunacak dosya yolları dizisi (en çok 10)" },
        },
        required: ["paths"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Yıldızlı desenle dosya bulur. '*' tek segment, çift-yıldız dizinler arası, '?' tek karakter. Örn: 'src/**/*.tsx', '*.json'.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob deseni. Örn: 'src/**/*.ts'" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "REGEX ile dosya İÇERİKLERİnde arar; 'dosya:satır: eşleşen satır' döndürür. 'glob' ile kapsamı daralt (büyük repolarda gerekli).",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Aranacak regex. Örn: 'function\\s+\\w+', 'TODO'" },
          glob: { type: "string", description: "Aramayı sınırlayan dosya deseni (opsiyonel). Örn: 'src/**/*.ts'" },
          ignore_case: { type: "boolean", description: "Büyük/küçük harf duyarsız (opsiyonel)" },
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
      description: "YENİ dosya oluşturur veya bir dosyayı TAMAMEN değiştirir (tüm içerik). Var olan bir dosyada KÜÇÜK değişiklik yapacaksan write_file yerine str_replace kullan — daha hızlı ve ucuz. Yazdıktan sonra commit eder.",
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
      name: "str_replace",
      description: "Var olan bir dosyada HEDEFLİ düzenleme: old_string'i new_string ile değiştirir (tüm dosyayı yeniden yazmaz — daha hızlı, ucuz, güvenli). old_string dosyada BENZERSİZ ve birebir eşleşmeli (girinti/boşluk dahil). Eşleşme yoksa veya birden çoksa hata döner; o zaman daha fazla bağlam ekle. Değişiklik commit edilir.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repo köküne göre dosya yolu" },
          old_string: { type: "string", description: "Değiştirilecek MEVCUT metin — ham kod (satır numarası OLMADAN), girinti dahil birebir" },
          new_string: { type: "string", description: "Yerine yazılacak yeni metin" },
          commit_message: { type: "string", description: "Commit mesajı (opsiyonel)" },
          replace_all: { type: "boolean", description: "true ise tüm eşleşmeleri değiştirir (opsiyonel, varsayılan false)" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Bir dosyanın SİLİNMESİNİ ÖNERİR. Doğrudan silmez — kullanıcıya onay olarak sunulur, ancak kullanıcı onaylarsa silinir. Yıkıcı işlem olduğu için yalnızca gerçekten gerektiğinde kullan.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Silinecek dosyanın repo köküne göre yolu" },
          reason: { type: "string", description: "Neden silinmeli (kullanıcının onay ekranında görünür)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Bir dosyanın YENİDEN ADLANDIRILMASINI/TAŞINMASINI ÖNERİR. Doğrudan yapmaz — kullanıcı onayına sunulur. İçerik korunur; onaylanırsa yeni yola yazılıp eski yol silinir.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Mevcut dosya yolu" },
          new_path: { type: "string", description: "Yeni dosya yolu" },
          reason: { type: "string", description: "Neden (opsiyonel, onay ekranında görünür)" },
        },
        required: ["path", "new_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_agents",
      description: "Karmaşık bir görevi PARALEL alt-ajanlara böler (Claude'daki Task/subagent gibi). Her alt-ajan repoyu salt-okunur araçlarla BAĞIMSIZ inceler ve sonucunu döndürür; sen sonuçları birleştirip uygularsın. Yalnızca birbirinden bağımsız, aynı anda yapılabilen 2-4 alt görev için kullan (ör. farklı modülleri/konuları paralel araştırmak). Basit görevlerde KULLANMA — kendin oku.",
      parameters: {
        type: "object",
        properties: {
          tasks: { type: "array", description: "Alt görevler dizisi: [{title, instruction}] (2-4 adet, bağımsız)" },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "Çok adımlı bir görev için canlı yapılacaklar listesini (plan) günceller; kullanıcı ilerlemeyi görür. Göreve başlarken tüm adımları yaz, her adım bitince listeyi yeniden gönder. Her satır bir adım: '[ ]' bekliyor, '[~]' devam ediyor, '[x]' tamamlandı. Örn: '[x] Dosyaları incele\\n[~] Bug'ı düzelt\\n[ ] Testi çalıştır'.",
      parameters: {
        type: "object",
        properties: {
          plan: { type: "string", description: "Her satırda bir adım: '[ ]' / '[~]' / '[x]' durum işaretiyle başlar" },
        },
        required: ["plan"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Bağlı terminalde bir kabuk komutu ÇALIŞTIRIR ve çıktısını görür (Claude Code gibi). Test/lint/build/git gibi komutları çalıştırıp sonucuna göre devam et — ör. 'npm test', 'npm run build', 'ls', 'node -v', 'git status'. Komut terminalde çalışır; çıktısı sana ayrı bir mesaj olarak döner, ona göre düzelt/sürdür. Tehlikeli/yıkıcı komutlardan (rm -rf, sudo, format) kaçın.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Çalıştırılacak tek satırlık kabuk komutu. Örn: 'npm test'" },
        },
        required: ["command"],
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
      name: "create_pr",
      description: "head dalından base dalına bir Pull Request (GitHub) / Merge Request (GitLab) açar. Değişiklikleri ayrı bir dala yazıp sonra bu araçla PR açmak iyi pratiktir. Başlık ve açıklamayı sen üret.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "PR/MR başlığı" },
          head: { type: "string", description: "Kaynak dal (değişikliklerin olduğu)" },
          base: { type: "string", description: "Hedef dal (genelde ana dal)" },
          body: { type: "string", description: "PR/MR açıklaması (markdown, opsiyonel)" },
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
          limit: { type: "string", description: "Kaç commit gösterilsin (varsayılan 10, max 30)" },
          path: { type: "string", description: "Sadece belirli dosyayı etkileyen commit'ler (opsiyonel)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Kullanıcıya tıklanabilir seçenekli yapılandırılmış soru(lar) sor. KOD YAZMADAN ÖNCE belirsizlikleri netleştirmek; yaklaşım, kütüphane, kapsam, tasarım veya YAYIN ortamı gibi sana bırakılan önemli kararları sormak için kullan. Kullanıcı bir veya birden çok seçeneği tıklar ya da 'Diğer' alanına serbest metin yazar. Cevabı aldıktan SONRA elde edilen bilgiyle görevi tamamla. Tahmin etmek yerine SOR — ama yalnızca gerçekten gerektiğinde (1-2 net karar).",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "1–4 adet soru. Her soru: kısa başlık (header), tam soru metni (question), 2–4 seçenek (options).",
            items: {
              type: "object",
              properties: {
                header: { type: "string", description: "Kısa başlık (≤12 karakter). Örn: 'Kütüphane', 'Yaklaşım', 'Yayın'" },
                question: { type: "string", description: "Tam soru metni. Soru işaretiyle bit." },
                options: {
                  type: "array",
                  description: "2–4 seçenek. Her biri: label (kısa etiket) + description (ne zaman tercih edilir).",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string", description: "Seçenek etiketi (1–5 kelime)" },
                      description: { type: "string", description: "Seçeneği açıklayan kısa not / takas" },
                    },
                    required: ["label"],
                  },
                },
              },
              required: ["header", "question", "options"],
            },
          },
        },
        required: ["questions"],
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
