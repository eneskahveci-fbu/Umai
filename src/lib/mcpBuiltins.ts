/* Yerleşik (self-hosted) MCP araçları — Tem 2026 kullanıcı kararı: "açık
   kaynak olan ve doğrudan varsayılan olarak yükleyebileceğin eklentiler
   varsa doğrudan ekle." Gerçek üçüncü-taraf MCP referans sunucularının
   (zaman, adım-adım-düşünme, everything/test) İŞLEVİNİ, dış bir URL
   UYDURMADAN, bu uygulamanın KENDİ backend'inde (aynı köken, göreli yol)
   yeniden uygular — böylece MCP_CATALOG'daki karşılık gelen kartlar
   gerçekten "aç" yapılınca hiçbir kullanıcı yapılandırması gerekmeden
   ÇALIŞIR. Saf mantık burada (testable); `src/app/api/mcp/builtin/
   [server]/tools/[action]/route.ts` yalnızca HTTP'ye bağlar. */

export interface BuiltinToolDef {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

export const BUILTIN_MCP_SERVERS = ["time", "sequential-thinking", "everything"] as const;
export type BuiltinMcpServerId = (typeof BUILTIN_MCP_SERVERS)[number];

export function isBuiltinMcpServerId(id: string): id is BuiltinMcpServerId {
  return (BUILTIN_MCP_SERVERS as readonly string[]).includes(id);
}

/** Bir sunucu URL'i yerleşik bir araca mı işaret ediyor? Bu yollar HER ZAMAN
    aynı dağıtımın kendi API route'una gider — dış host'a asla erişemez,
    SSRF riski taşımaz (bkz. urlSafety.ts'teki muafiyet). */
export function isBuiltinMcpPath(url: string): boolean {
  return BUILTIN_MCP_SERVERS.some((id) => url === `/api/mcp/builtin/${id}`);
}

export function builtinMcpUrl(id: BuiltinMcpServerId): string {
  return `/api/mcp/builtin/${id}`;
}

const TOOLS: Record<BuiltinMcpServerId, BuiltinToolDef[]> = {
  time: [
    {
      name: "get_current_time",
      description: "Verilen IANA saat diliminde (ör. Europe/Istanbul) güncel tarih ve saati döndürür.",
      inputSchema: { type: "object", properties: { timezone: { type: "string", description: "IANA saat dilimi, ör. Europe/Istanbul" } }, required: ["timezone"] },
    },
    {
      name: "convert_time",
      description: "HH:MM biçimindeki bir saati bir saat diliminden diğerine çevirir.",
      inputSchema: {
        type: "object",
        properties: {
          source_timezone: { type: "string" },
          time: { type: "string", description: "HH:MM" },
          target_timezone: { type: "string" },
        },
        required: ["source_timezone", "time", "target_timezone"],
      },
    },
  ],
  "sequential-thinking": [
    {
      name: "sequentialthinking",
      description: "Karmaşık bir problemi adım adım, denetlenebilir düşünce adımlarına böler; her çağrı bir adımı kaydeder.",
      inputSchema: {
        type: "object",
        properties: {
          thought: { type: "string" },
          thoughtNumber: { type: "number" },
          totalThoughts: { type: "number" },
          nextThoughtNeeded: { type: "boolean" },
        },
        required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"],
      },
    },
  ],
  everything: [
    {
      name: "echo",
      description: "Verilen mesajı olduğu gibi geri döndürür (bağlantıyı test etmek için).",
      inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
    },
    {
      name: "add",
      description: "İki sayıyı toplar (bağlantıyı test etmek için).",
      inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
    },
  ],
};

export function listBuiltinTools(server: BuiltinMcpServerId): BuiltinToolDef[] {
  return TOOLS[server];
}

/** "en-US"+hourCycle h23 ile formatlayıp UTC'ye göre dakika farkını hesaplar
    — harici bir saat dilimi kütüphanesi olmadan, Intl üzerinden. */
function zonedOffsetMinutes(timezone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUTC - at.getTime()) / 60000;
}

export function getCurrentTime(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("tr-TR", { timeZone: timezone, dateStyle: "full", timeStyle: "long" });
    return fmt.format(new Date());
  } catch {
    return `Geçersiz saat dilimi: "${timezone}".`;
  }
}

export function convertTime(sourceTimezone: string, time: string, targetTimezone: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return `Geçersiz saat biçimi: "${time}" (HH:MM bekleniyor).`;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return `Geçersiz saat biçimi: "${time}".`;
  try {
    const now = new Date();
    const srcOffset = zonedOffsetMinutes(sourceTimezone, now);
    const tgtOffset = zonedOffsetMinutes(targetTimezone, now);
    const baseUTCMinutes = hh * 60 + mm - srcOffset;
    const targetMinutes = ((baseUTCMinutes + tgtOffset) % 1440 + 1440) % 1440;
    const outH = String(Math.floor(targetMinutes / 60)).padStart(2, "0");
    const outM = String(targetMinutes % 60).padStart(2, "0");
    return `${sourceTimezone} ${time} → ${targetTimezone} ${outH}:${outM}`;
  } catch {
    return `Geçersiz saat dilimi: "${sourceTimezone}" veya "${targetTimezone}".`;
  }
}

/** Yerleşik bir MCP sunucusunun tools/call'ını çalıştırır — saf, HTTP'siz. */
export function callBuiltinTool(server: BuiltinMcpServerId, toolName: string, args: Record<string, unknown>): string {
  if (server === "time") {
    if (toolName === "get_current_time") return getCurrentTime(String(args.timezone ?? ""));
    if (toolName === "convert_time") return convertTime(String(args.source_timezone ?? ""), String(args.time ?? ""), String(args.target_timezone ?? ""));
  }
  if (server === "sequential-thinking" && toolName === "sequentialthinking") {
    const thought = String(args.thought ?? "");
    return JSON.stringify({
      thoughtNumber: args.thoughtNumber ?? null,
      totalThoughts: args.totalThoughts ?? null,
      nextThoughtNeeded: args.nextThoughtNeeded ?? null,
      thoughtLength: thought.length,
      status: "kaydedildi",
    });
  }
  if (server === "everything") {
    if (toolName === "echo") return String(args.message ?? "");
    if (toolName === "add") return String(Number(args.a ?? 0) + Number(args.b ?? 0));
  }
  return `Bilinmeyen araç: ${toolName}`;
}
