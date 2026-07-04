/* Doküman Stüdyosu çekirdeği — Notion'dan İLHAM alan (klonu değil) craft
   yorumu: doküman = blok listesi (başlık, paragraf, madde, yapılacak, alıntı,
   kod, ayraç). LLM yapılandırılmış blok JSON'u üretir; craft düzenler ve
   Markdown / bağımsız HTML olarak dışa aktarır. */
import type { CraftDoc, DocBlock, DocBlockType } from "./types";
import { escapeHtml } from "./slides";
import { streamChat, extractJsonObject } from "./genChat";

export const DOC_BLOCK_TYPES: { id: DocBlockType; name: string }[] = [
  { id: "h1", name: "Başlık 1" },
  { id: "h2", name: "Başlık 2" },
  { id: "p", name: "Paragraf" },
  { id: "bullet", name: "Madde" },
  { id: "todo", name: "Yapılacak" },
  { id: "quote", name: "Alıntı" },
  { id: "code", name: "Kod" },
  { id: "divider", name: "Ayraç" },
];

export const MAX_DOC_BLOCKS = 120;

export function newBlockId(): string {
  return `db_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newBlock(type: DocBlockType = "p", text = ""): DocBlock {
  const b: DocBlock = { id: newBlockId(), type, text };
  if (type === "todo") b.checked = false;
  return b;
}

/* ── LLM çıktısını güvenli dokümana çevirme ─────────────────────────── */

const VALID_TYPES: DocBlockType[] = ["h1", "h2", "p", "bullet", "todo", "quote", "code", "divider"];

function normalizeBlock(raw: unknown): DocBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = VALID_TYPES.includes(r.type as DocBlockType) ? (r.type as DocBlockType) : "p";
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (!text && type !== "divider") return null;
  const b: DocBlock = { id: newBlockId(), type, text };
  if (type === "todo") b.checked = r.checked === true;
  return b;
}

export function normalizeDoc(raw: unknown, fallbackTitle = "Doküman"): CraftDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const blocks = (Array.isArray(r.blocks) ? r.blocks : [])
    .map(normalizeBlock)
    .filter((b): b is DocBlock => b !== null)
    .slice(0, MAX_DOC_BLOCKS);
  if (!blocks.length) return null;
  const now = Date.now();
  return {
    id: `doc_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: (typeof r.title === "string" && r.title.trim()) ? r.title.trim() : fallbackTitle,
    blocks,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseDocJson(text: string, fallbackTitle = "Doküman"): CraftDoc {
  let raw: unknown;
  try { raw = JSON.parse(extractJsonObject(text)); } catch { throw new Error("Doküman JSON'u bozuk — tekrar dene."); }
  const doc = normalizeDoc(raw, fallbackTitle);
  if (!doc) throw new Error("Dokümanda kullanılabilir blok yok — brief'i netleştir.");
  return doc;
}

/* ── Dışa aktarma ───────────────────────────────────────────────────── */

export function docToMarkdown(doc: CraftDoc): string {
  const lines: string[] = [`# ${doc.title}`, ""];
  for (const b of doc.blocks) {
    switch (b.type) {
      case "h1": lines.push(`# ${b.text}`, ""); break;
      case "h2": lines.push(`## ${b.text}`, ""); break;
      case "bullet": lines.push(`- ${b.text}`); break;
      case "todo": lines.push(`- [${b.checked ? "x" : " "}] ${b.text}`); break;
      case "quote": lines.push(`> ${b.text}`, ""); break;
      case "code": lines.push("```", b.text, "```", ""); break;
      case "divider": lines.push("---", ""); break;
      default: lines.push(b.text, "");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Bağımsız, yazdırılabilir HTML (okuma görünümü). */
export function docToHtml(doc: CraftDoc): string {
  const body = doc.blocks.map((b) => {
    const t = escapeHtml(b.text);
    switch (b.type) {
      case "h1": return `<h1>${t}</h1>`;
      case "h2": return `<h2>${t}</h2>`;
      case "bullet": return `<li>${t}</li>`;
      case "todo": return `<p class="todo"><input type="checkbox" disabled${b.checked ? " checked" : ""}> ${t}</p>`;
      case "quote": return `<blockquote>${t}</blockquote>`;
      case "code": return `<pre><code>${t}</code></pre>`;
      case "divider": return `<hr>`;
      default: return `<p>${t}</p>`;
    }
  }).join("\n")
    /* Ardışık <li>'leri tek <ul> altında topla. */
    .replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>\n${m}</ul>\n`);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title)}</title>
<style>
  body { max-width: 72ch; margin: 3rem auto; padding: 0 1.25rem; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
         color: #1f1e1b; background: #faf8f2; line-height: 1.65; }
  h1 { font-size: 2rem; letter-spacing: -0.02em; line-height: 1.2; }
  h2 { font-size: 1.35rem; margin-top: 2.2rem; }
  h1::after, h2::after { content: ""; display: block; width: 3rem; height: 3px; background: #b45309; margin-top: .5rem; border-radius: 2px; }
  blockquote { border-left: 4px solid #b45309; margin: 1.2rem 0; padding: .3rem 1rem; color: #6b675e; font-style: italic; }
  pre { background: #1c1c1a; color: #f4f2ec; padding: 1rem 1.2rem; border-radius: .6rem; overflow-x: auto; font-size: .9rem; }
  ul { padding-left: 1.4rem; } li { margin: .3rem 0; }
  .todo { display: flex; align-items: baseline; gap: .5rem; margin: .3rem 0; }
  hr { border: 0; border-top: 1px solid #e2ddd0; margin: 2rem 0; }
  @media print { body { background: #fff; margin: 0 auto; } }
  @media (prefers-color-scheme: dark) {
    body { background: #111110; color: #f4f2ec; }
    blockquote { color: #a8a396; } hr { border-top-color: #33322e; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(doc.title)}</h1>
${body}
</body>
</html>`;
}

/* ── Üretim ─────────────────────────────────────────────────────────── */

const DOC_SCHEMA =
  '{"title": "doküman başlığı", "blocks": [{"type": "h1|h2|p|bullet|todo|quote|code|divider", "text": "içerik", "checked": false}]}';

export interface DocGenOptions {
  brief: string;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export async function generateDoc(opts: DocGenOptions): Promise<CraftDoc> {
  const sys =
    "Sen kıdemli bir teknik yazar ve editörsün. Kullanıcının brief'inden iyi yapılandırılmış, " +
    "TÜRKÇE bir doküman üret. SADECE geçerli JSON döndür (istersen tek ```json bloğu) — açıklama yazma. Şema:\n" +
    DOC_SCHEMA + "\n" +
    "Kurallar: h2 ile bölümle; paragrafları kısa tut (≤4 cümle); listelenebilir içeriği bullet yap; " +
    "eylem maddelerini todo yap; önemli tek cümleyi quote yap. Bilgi uydurma; brief'te olmayan " +
    "sayısal iddia ekleme. 8-30 blok arası, taranabilir ve öz.";
  const full = await streamChat({ system: sys, messages: [{ role: "user", content: opts.brief }], onDelta: opts.onDelta, signal: opts.signal, temperature: 0.6 });
  const doc = parseDocJson(full, opts.brief.slice(0, 48));
  doc.brief = opts.brief;
  return doc;
}

/** Mevcut dokümanın sonuna AI ile devam blokları ekler. */
export async function continueDoc(doc: CraftDoc, instruction: string, signal?: AbortSignal): Promise<DocBlock[]> {
  const sys =
    "Bir dokümana DEVAM blokları yazıyorsun. SADECE JSON döndür: {\"blocks\": [...]} — şema ve kurallar aynı:\n" + DOC_SCHEMA +
    "\nMevcut içeriği TEKRARLAMA; akışı ve tonu sürdür; 3-10 yeni blok üret. Türkçe.";
  const user = `Doküman:\n${docToMarkdown(doc).slice(0, 6000)}\n\nİstek: ${instruction || "Doğal biçimde devam et."}`;
  const full = await streamChat({ system: sys, messages: [{ role: "user", content: user }], signal, temperature: 0.7 });
  const parsed = normalizeDoc(JSON.parse(extractJsonObject(full)), doc.title);
  if (!parsed) throw new Error("Devam blokları üretilemedi — tekrar dene.");
  return parsed.blocks;
}
