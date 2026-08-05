/* İşçi-ajanlar (orkestrasyon) için SALT-OKUNUR repo araçları.
   Ayrı modül: çalışan /api/chat akışına dokunmaz (regresyon riski yok).
   Yalnızca okuma/listeleme — yazma/silme YOK (işçiler değiştiremez). */

import { isSafeRemoteUrl } from "./urlSafety";

export interface RepoReadCtx {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab" | "local";
  /** Yerel Mod köprüsü (gerçek dosya sistemi). */
  bridgeUrl?: string;
  bridgeToken?: string;
}

/* Yerel Mod köprüsüne çağrı (alt-ajanların salt-okunur erişimi için). */
async function bridgeCall(ctx: RepoReadCtx, endpoint: string, payload?: unknown): Promise<Record<string, unknown>> {
  const base = (ctx.bridgeUrl || "").replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && !isSafeRemoteUrl(base)) {
    throw new Error("Güvensiz köprü adresi — yalnızca genel (public) HTTPS adresleri kabul edilir.");
  }
  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bridgeToken || ""}` },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Yerel köprü hatası ${res.status}`);
  return await res.json() as Record<string, unknown>;
}

export interface ReadToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, { type: string; description: string }>; required: string[] };
  };
}

export const READONLY_TOOLS: ReadToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Repo dosya ağacını listeler (yollar).",
      parameters: { type: "object", properties: { filter: { type: "string", description: "Yolda aranacak alt-string (opsiyonel)" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Bir dosyanın içeriğini SATIR NUMARALARIYLA okur.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Repo köküne göre yol" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Dosya İÇERİĞİNDE arama yapar (grep gibi) — hangi dosyada/satırda geçtiğini bulmak için list_files+read_file'ı tek tek denemek yerine BUNU kullan.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin/kod parçası" },
          extension: { type: "string", description: "Yalnız bu uzantıdaki dosyalarla sınırla (opsiyonel, ör. 'ts')" },
        },
        required: ["query"],
      },
    },
  },
];

export const READONLY_TOOL_NAMES = new Set(READONLY_TOOLS.map((t) => t.function.name));

/** İçeriğe 1'den başlayan satır numaraları ekler (Claude Code 'cat -n' gibi). */
export function withLineNumbers(content: string): string {
  return content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n");
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}
function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "craft-ai-web" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function listFiles(ctx: RepoReadCtx, filter?: string): Promise<string> {
  let paths: string[] = [];
  if (ctx.provider === "local") {
    const data = await bridgeCall(ctx, "/fs/list", {});
    paths = Array.isArray(data.paths) ? data.paths as string[] : [];
    if (filter) paths = paths.filter((p) => p.toLowerCase().includes(filter.toLowerCase()));
    if (paths.length > 300) return paths.slice(0, 300).join("\n") + `\n[... ${paths.length - 300} dosya daha — filtre kullan]`;
    return paths.join("\n") || "(dosya yok)";
  }
  if (ctx.provider === "gitlab") {
    /* GitLab ağacı sayfa başına en çok 100 kayıt döner (GitHub'ın
       `recursive=1`'i gibi tek seferde değil). Sayfalama yokken alt-ajanlar
       GitLab depolarında yalnız ilk 100 dosyayı görüyordu — büyük repolarda
       var olan dosyalar "yok" görünüyordu. `x-next-page` ile devam et. */
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    let page = 1;
    while (page <= 10) {
      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${proj}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(ctx.branch)}`,
        { headers: glHeaders(ctx.token) },
      );
      if (!res.ok) return `Hata: ${res.status} — ağaç alınamadı`;
      const data = (await res.json()) as { path: string; type: string }[];
      if (!Array.isArray(data) || data.length === 0) break;
      for (const d of data) if (d.type === "blob") paths.push(d.path);
      const nextPage = res.headers.get("x-next-page");
      if (!nextPage) break;
      const parsed = parseInt(nextPage, 10);
      if (!Number.isFinite(parsed) || parsed <= page) break;
      page = parsed;
    }
  } else {
    const res = await fetch(
      `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${encodeURIComponent(ctx.branch)}?recursive=1`,
      { headers: ghHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — ağaç alınamadı`;
    const data = (await res.json()) as { tree?: { path: string; type: string }[] };
    paths = (data.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
  }
  if (filter) paths = paths.filter((p) => p.toLowerCase().includes(filter.toLowerCase()));
  if (paths.length > 300) return paths.slice(0, 300).join("\n") + `\n[... ${paths.length - 300} dosya daha — filtre kullan]`;
  return paths.join("\n") || "(dosya yok)";
}

async function readFile(ctx: RepoReadCtx, path: string): Promise<string> {
  if (ctx.provider === "local") {
    const data = await bridgeCall(ctx, "/fs/read", { path });
    if (typeof data.error === "string") return `Hata: ${data.error} (${path})`;
    return withLineNumbers(typeof data.content === "string" ? data.content : "").slice(0, 16_000);
  }
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ctx.branch)}`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${path})`;
    const text = await res.text();
    return withLineNumbers(text).slice(0, 16_000);
  }
  const res = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${encodeURIComponent(path)}?ref=${ctx.branch}`,
    { headers: ghHeaders(ctx.token) },
  );
  if (!res.ok) return `Hata: ${res.status} — dosya bulunamadı (${path})`;
  const data = (await res.json()) as { content?: string; size?: number };
  if ((data.size ?? 0) > 100_000) return `Hata: dosya çok büyük`;
  const content = Buffer.from(data.content ?? "", "base64").toString("utf-8");
  return withLineNumbers(content).slice(0, 16_000);
}

async function searchCode(ctx: RepoReadCtx, query: string, extension?: string): Promise<string> {
  if (!query) return "Hata: query boş";
  if (ctx.provider === "local") {
    try {
      const glob = extension ? `**/*.${extension}` : undefined;
      const data = await bridgeCall(ctx, "/fs/grep", { pattern: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), glob });
      if (typeof data.error === "string") return `Hata: ${data.error}`;
      const matches = Array.isArray(data.matches) ? data.matches as string[] : [];
      return matches.length ? matches.slice(0, 30).join("\n") : "(eşleşme yok)";
    } catch (e) { return `Hata: ${(e as Error).message}`; }
  }
  if (ctx.provider === "gitlab") {
    const proj = encodeURIComponent(`${ctx.owner}/${ctx.repo}`);
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/search?scope=blobs&search=${q}&ref=${encodeURIComponent(ctx.branch)}&per_page=20`,
      { headers: glHeaders(ctx.token) },
    );
    if (!res.ok) return `Hata: ${res.status}`;
    const data = await res.json() as { path: string; data: string; startline: number }[];
    if (!Array.isArray(data) || !data.length) return "(eşleşme yok)";
    return data
      .filter((r) => !extension || r.path.endsWith(`.${extension}`))
      .slice(0, 15)
      .map((r) => `${r.path}:${r.startline}\n  ${r.data.trim().slice(0, 120)}`)
      .join("\n\n") || "(eşleşme yok)";
  }
  const q = encodeURIComponent(`${query} repo:${ctx.owner}/${ctx.repo}${extension ? ` extension:${extension}` : ""}`);
  const res = await fetch(`https://api.github.com/search/code?q=${q}&per_page=15`, { headers: ghHeaders(ctx.token) });
  if (!res.ok) return `Hata: ${res.status}`;
  const data = await res.json() as { items?: { path: string }[] };
  const items = data.items ?? [];
  return items.length ? items.map((it) => it.path).join("\n") : "(eşleşme yok)";
}

/* ── YAZMA araçları (yalnız gerçek dosya sistemi = köprü modunda) ──
   Neden yalnız köprüde: GitHub/GitLab API yolunda her yazma bir COMMIT'tir.
   Paralel çalışan alt-ajanlar aynı dala aynı anda commit atarsa yarış/çakışma
   olur (birinin yazdığı diğerinin base SHA'sını bayatlatır) ve kullanıcı
   yarım kalmış bir geçmişle baş başa kalır. Gerçek dosya sisteminde ise
   paralel yazma doğaldır — Claude'un alt-ajanları da tek bir çalışma
   klasöründe böyle çalışır. Bu yüzden yazma yetkisi provider'a göre AÇIKÇA
   kapatılır, sessizce başarısız olmaz. */
export const WRITE_TOOLS: ReadToolDef[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Dosyayı OLUŞTURUR veya tamamen değiştirir. Küçük düzenlemeler için str_replace'i tercih et.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repo köküne göre yol" },
          content: { type: "string", description: "Dosyanın tam yeni içeriği" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "str_replace",
      description: "Dosyada BELİRLİ bir metni yenisiyle değiştirir (hedefli düzenleme). old_string dosyada tam olarak BİR KEZ geçmeli.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repo köküne göre yol" },
          old_string: { type: "string", description: "Değiştirilecek MEVCUT metin (birebir)" },
          new_string: { type: "string", description: "Yerine yazılacak yeni metin" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
];

async function bridgeWriteFile(ctx: RepoReadCtx, path: string, content: string): Promise<string> {
  if (!path) return "Hata: path boş";
  const data = await bridgeCall(ctx, "/fs/write", { path, content });
  if (typeof data.error === "string") return `Hata: ${data.error}`;
  return `✅ ${path} yazıldı${data.created ? " (yeni dosya)" : ""}.`;
}

async function bridgeStrReplace(ctx: RepoReadCtx, path: string, oldStr: string, newStr: string): Promise<string> {
  if (!path) return "Hata: path boş";
  if (!oldStr) return "Hata: old_string boş";
  const read = await bridgeCall(ctx, "/fs/read", { path });
  if (typeof read.error === "string") return `Hata: ${read.error} (${path})`;
  const current = typeof read.content === "string" ? read.content : "";
  const occurrences = current.split(oldStr).length - 1;
  if (occurrences === 0) return `Hata: old_string '${path}' içinde bulunamadı. Önce read_file ile içeriği doğrula.`;
  if (occurrences > 1) return `Hata: old_string '${path}' içinde ${occurrences} kez geçiyor — benzersiz olacak şekilde genişlet.`;
  const updated = current.replace(oldStr, newStr);
  const w = await bridgeCall(ctx, "/fs/write", { path, content: updated });
  if (typeof w.error === "string") return `Hata: ${w.error}`;
  return `✅ ${path}: 1 eşleşme değiştirildi.`;
}

/** Alt-ajan araç çağrısını yürütür.
    `allowWrite` false ise (varsayılan) yazma araçları REDDEDİLİR — çağıran
    taraf yetkiyi açıkça vermek zorundadır. */
export async function executeReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: RepoReadCtx,
  allowWrite = false,
): Promise<string> {
  try {
    if (name === "list_files") return await listFiles(ctx, typeof args.filter === "string" ? args.filter : undefined);
    if (name === "read_file") return await readFile(ctx, String(args.path ?? ""));
    if (name === "search_code") return await searchCode(ctx, String(args.query ?? ""), typeof args.extension === "string" ? args.extension : undefined);
    if (name === "write_file" || name === "str_replace") {
      if (!allowWrite) return `Bu alt-ajanın yazma yetkisi yok; '${name}' kullanılamaz. Bulgularını rapor et, değişikliği ana ajan uygular.`;
      /* Savunma derinliği: yetki verilse bile yalnız gerçek dosya sisteminde
         yaz. API yolunda commit yarışı olacağı için burada da kapalı. */
      if (ctx.provider !== "local") return `Yazma yalnız çalışma alanı sunucusu (köprü) bağlıyken mümkün; '${name}' bu modda kullanılamaz.`;
      if (name === "write_file") return await bridgeWriteFile(ctx, String(args.path ?? ""), String(args.content ?? ""));
      return await bridgeStrReplace(ctx, String(args.path ?? ""), String(args.old_string ?? ""), String(args.new_string ?? ""));
    }
    return `Bu ajan '${name}' aracını kullanamaz.`;
  } catch (e) {
    return `Hata: ${(e as Error).message}`;
  }
}
