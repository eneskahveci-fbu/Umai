/* Kroki çekirdeği — zihin haritası (mind-map): brief → AI ağaç → düzenlenebilir
   SVG kroki. Tek doğruluk kaynağı `layoutMap` (saf yerleşim); uygulama içi
   React render'ı da, bağımsız SVG dışa aktarma da AYNI yerleşimi kullanır.
   Dışa aktarma: .svg / Markdown taslak / yayınlanabilir SVG (/api/publish). */
import type { CraftMap, MindNode } from "./types";
import { escapeHtml } from "./slides";
import { extractJsonObject } from "./jsonExtract";
import { streamJson } from "./genJson";

export const MAX_MAP_NODES = 80;

/* Token bütçesi — kroki düğüm metinleri kısa (80 karakter tavanlı), bu yüzden
   Doküman/Kartlar kadar cömert olmasına gerek yok; dallandırma alt-çağrısı
   ise tek düğümün çocuklarını üretiyor, çok daha küçük. */
const MAP_MAX_TOKENS = 8_000;
const MAP_EXPAND_MAX_TOKENS = 3_000;
export const MAX_MAP_DEPTH = 4;   // kök = 0
export const MAX_NODE_CHILDREN = 8;
export const MAX_NODE_TEXT = 80;

export function newNodeId(): string {
  return `mn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newNode(text = "Yeni dal"): MindNode {
  return { id: newNodeId(), text, children: [] };
}

/* ── Ağaç yardımcıları (saf — hepsi YENİ kök döndürür) ─────────────────── */

export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export function countNodes(root: MindNode): number {
  return 1 + root.children.reduce((a, c) => a + countNodes(c), 0);
}

export function updateNodeText(root: MindNode, id: string, text: string): MindNode {
  if (root.id === id) return { ...root, text };
  return { ...root, children: root.children.map((c) => updateNodeText(c, id, text)) };
}

/** Hedefe çocuk ekler; ağaç/derinlik/dal sınırlarını aşarsa değişmeden döner. */
export function addChild(root: MindNode, parentId: string, child: MindNode): MindNode {
  if (countNodes(root) >= MAX_MAP_NODES) return root;
  const walk = (n: MindNode, depth: number): MindNode => {
    if (n.id === parentId) {
      if (depth >= MAX_MAP_DEPTH || n.children.length >= MAX_NODE_CHILDREN) return n;
      return { ...n, children: [...n.children, child] };
    }
    return { ...n, children: n.children.map((c) => walk(c, depth + 1)) };
  };
  return walk(root, 0);
}

/** Düğümü (alt ağacıyla) siler; kök silinemez. */
export function deleteNode(root: MindNode, id: string): MindNode {
  if (root.id === id) return root;
  return {
    ...root,
    children: root.children.filter((c) => c.id !== id).map((c) => deleteNode(c, id)),
  };
}

/* ── LLM çıktısını güvenli haritaya çevirme ────────────────────────────── */

interface RawNode { text?: unknown; children?: unknown }

function normalizeNode(raw: unknown, depth: number, budget: { left: number }): MindNode | null {
  if (!raw || typeof raw !== "object" || budget.left <= 0) return null;
  const r = raw as RawNode;
  const text = typeof r.text === "string" ? r.text.trim().slice(0, MAX_NODE_TEXT) : "";
  if (!text) return null;
  budget.left--;
  const node: MindNode = { id: newNodeId(), text, children: [] };
  if (depth < MAX_MAP_DEPTH && Array.isArray(r.children)) {
    for (const c of r.children.slice(0, MAX_NODE_CHILDREN)) {
      const child = normalizeNode(c, depth + 1, budget);
      if (child) node.children.push(child);
    }
  }
  return node;
}

export function normalizeMap(raw: unknown, fallbackTitle = "Kroki"): CraftMap | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const root = normalizeNode(r.root, 0, { left: MAX_MAP_NODES });
  if (!root || !root.children.length) return null;
  const now = Date.now();
  return {
    id: `map_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: (typeof r.title === "string" && r.title.trim()) ? r.title.trim() : fallbackTitle,
    root,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseMapJson(text: string, fallbackTitle = "Kroki"): CraftMap {
  let raw: unknown;
  try { raw = JSON.parse(extractJsonObject(text)); } catch { throw new Error("Kroki JSON'u bozuk — tekrar dene."); }
  const map = normalizeMap(raw, fallbackTitle);
  if (!map) throw new Error("Krokide kullanılabilir dal yok — brief'i netleştir.");
  return map;
}

/* ── Yerleşim (saf) — kök solda, dallar sağa doğru katmanlı ağaç ───────── */

export interface LaidNode {
  id: string;
  text: string;
  /** Kutu içinde gösterilecek satırlar (en çok 2 — bkz. wrapNodeText).
      Düğüm genişliği (nodeWidth) 240px'te tavan yaptığından metin tek satıra
      sığmayabilir. Tek yerde hesaplanır: React tuvali VE dışa aktarılan SVG
      (mapToSvg) AYNI değeri kullanır — ÖNCEDEN yalnız React tarafı kendi
      30-karakter kısaltmasını uyguluyordu, dışa aktarılan SVG tam metni
      bastığından yayınlanan SVG'de metin kutudan TAŞIYORDU. */
  lines: string[];
  /** Geriye dönük uyum + erişilebilirlik: satırların tek satırlık birleşimi. */
  displayText: string;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/* Düğüm metni artık TEK satıra kırpılmıyor, EN ÇOK İKİ SATIRA sarılıyor.
   Ölçüldü (Playwright, gerçek bir kroki): normalizeNode 80 karaktere kadar
   metni kabul ederken kutuda yalnız 30 karakter gösteriliyordu; "Konumlandırma
   ve mesajlaşma stratejisi" gibi tamamen meşru düğümler kelime ortasından
   "…s…" diye kesiliyordu. Üstelik mapToMarkdown TAM metni dışa aktardığından
   iki dışa aktarma birbiriyle çelişiyordu. İki satır, 240px tavanı aşmadan
   ~52 karakter taşıyor. */
const MAX_LINE_CHARS = 26;
const MAX_NODE_LINES = 2;

function clipLine(s: string, force = false): string {
  if (!force && s.length <= MAX_LINE_CHARS) return s;
  return s.slice(0, MAX_LINE_CHARS - 1).trimEnd() + "…";
}

/** Düğüm metnini kelime sınırlarında en çok iki satıra böler; hâlâ sığmıyorsa
    yalnız SON satırı elipsler. Saf fonksiyon — React tuvali ve dışa aktarılan
    SVG aynı sonucu kullanır. */
export function wrapNodeText(text: string): string[] {
  const t = text.trim();
  if (!t) return [""];
  if (t.length <= MAX_LINE_CHARS) return [t];

  const lines: string[] = [];
  let cur = "";
  for (const w of t.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= MAX_LINE_CHARS) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length >= MAX_NODE_LINES) break;
  }
  if (cur && lines.length < MAX_NODE_LINES) lines.push(cur);

  const out = lines.slice(0, MAX_NODE_LINES).map((l) => clipLine(l));
  /* Metnin tamamı sığmadıysa son satırı elipsle — kullanıcı kesildiğini görsün. */
  const shownChars = out.join(" ").replace(/…/g, "").length;
  if (shownChars < t.length && !out[out.length - 1].endsWith("…")) {
    out[out.length - 1] = clipLine(out[out.length - 1], true);
  }
  return out;
}

const LINE_H = 16;
/** Satır sayısına göre kutu yüksekliği (1 satır → 32, 2 satır → 48). */
export function nodeHeight(lineCount: number): number {
  return LINE_H * lineCount + 16;
}

export interface MapLayout {
  nodes: LaidNode[];
  /** SVG path (kübik bezier) — parent sağ orta → child sol orta. */
  edges: { from: string; to: string; path: string }[];
  width: number;
  height: number;
}

const ROW_GAP = 14;
const COL_GAP = 56;
const PAD = 24;

/** Kutu genişliği en UZUN SATIRDAN türer (tüm metinden değil) — iki satıra
    sarılan bir düğüm gereksiz yere 240px'e dayanmasın. */
function nodeWidth(lines: string[]): number {
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(240, Math.max(64, 24 + Math.round(longest * 7.4)));
}

export function layoutMap(root: MindNode): MapLayout {
  /* Metin sarma her düğüm için BİR kez hesaplanır (yerleşim + çizim aynı veriyi
     kullansın; ölçü ile çizim ayrışırsa metin kutudan taşar). */
  const wrapped = new Map<string, string[]>();
  const linesOf = (n: MindNode): string[] => {
    let l = wrapped.get(n.id);
    if (!l) { l = wrapNodeText(n.text); wrapped.set(n.id, l); }
    return l;
  };

  /* Sütun genişlikleri: her derinlikteki en geniş düğüm. */
  const colW: number[] = [];
  const scan = (n: MindNode, d: number) => {
    colW[d] = Math.max(colW[d] ?? 0, nodeWidth(linesOf(n)));
    n.children.forEach((c) => scan(c, d + 1));
  };
  scan(root, 0);
  const colX: number[] = [];
  let x = PAD;
  for (let d = 0; d < colW.length; d++) { colX[d] = x; x += colW[d] + COL_GAP; }

  const nodes: LaidNode[] = [];
  const edges: MapLayout["edges"] = [];
  /* Yapraklar sabit satır ızgarasına DEĞİL, yüksekliği değişken bir imlece
     dizilir: iki satırlık bir düğüm (48px) eski 46px'lik ızgarada bir
     sonrakiyle çakışırdı. */
  let cursorY = PAD;
  let maxBottom = PAD;
  const place = (n: MindNode, depth: number): number => {
    const lines = linesOf(n);
    const h = nodeHeight(lines.length);
    let cy: number;
    if (!n.children.length) {
      cy = cursorY + h / 2;
      cursorY += h + ROW_GAP;
    } else {
      const centers = n.children.map((c) => place(c, depth + 1));
      cy = (centers[0] + centers[centers.length - 1]) / 2;
    }
    const w = nodeWidth(lines);
    const nx = colX[depth];
    nodes.push({ id: n.id, text: n.text, lines, displayText: lines.join(" "), depth, x: nx, y: cy - h / 2, w, h });
    maxBottom = Math.max(maxBottom, cy + h / 2);
    for (const c of n.children) {
      const child = nodes.find((ln) => ln.id === c.id)!;
      const x1 = nx + w, y1 = cy, x2 = child.x, y2 = child.y + child.h / 2;
      const mx = (x1 + x2) / 2;
      edges.push({ from: n.id, to: c.id, path: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` });
    }
    return cy;
  };
  place(root, 0);

  return {
    nodes,
    edges,
    width: x - COL_GAP + PAD,
    /* İç düğüm çocuklarının ORTASINA oturduğundan imleci aşabilir — bu yüzden
       yükseklik gerçek en-alt kenardan hesaplanır. */
    height: Math.max(cursorY - ROW_GAP, maxBottom) + PAD,
  };
}

/* ── Dışa aktarma ──────────────────────────────────────────────────────── */

/** Bağımsız SVG belgesi (tema: açık zemin — yazdırma/paylaşma dostu). */
export function mapToSvg(map: CraftMap): string {
  const l = layoutMap(map.root);
  const edgePaths = l.edges
    .map((e) => `<path d="${e.path}" fill="none" stroke="#c9c3b4" stroke-width="1.5"/>`)
    .join("\n");
  const nodeRects = l.nodes.map((n) => {
    const isRoot = n.depth === 0;
    const fill = isRoot ? "#5c9478" : n.depth === 1 ? "#eef2ea" : "#faf8f2";
    const textFill = isRoot ? "#ffffff" : "#1f1e1b";
    const stroke = isRoot ? "#5c9478" : "#d9d3c4";
    const cx = n.x + n.w / 2;
    const spans = n.lines
      .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : 16}">${escapeHtml(line)}</tspan>`)
      .join("");
    /* İlk satırın taban çizgisi: kutu ortasından satır sayısına göre yukarı kaydır. */
    const firstBaseline = n.y + n.h / 2 + 4 - (n.lines.length - 1) * 8;
    return `<g>
<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${fill}" stroke="${stroke}"/>
<text x="${cx}" y="${firstBaseline}" text-anchor="middle" font-size="12.5" font-weight="${isRoot ? 700 : 500}" fill="${textFill}">${spans}</text>
</g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.width} ${l.height}" width="${l.width}" height="${l.height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
<title>${escapeHtml(map.title)}</title>
<rect width="100%" height="100%" fill="#ffffff"/>
${edgePaths}
${nodeRects}
</svg>`;
}

/** Markdown taslak (girintili madde listesi). */
export function mapToMarkdown(map: CraftMap): string {
  const lines: string[] = [`# ${map.title}`, ""];
  const walk = (n: MindNode, depth: number) => {
    if (depth === 0) lines.push(`**${n.text}**`, "");
    else lines.push(`${"  ".repeat(depth - 1)}- ${n.text}`);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(map.root, 0);
  return lines.join("\n").trimEnd() + "\n";
}

/* ── Üretim ────────────────────────────────────────────────────────────── */

const MAP_SCHEMA =
  '{"title": "kroki başlığı", "root": {"text": "merkez kavram", "children": [{"text": "ana dal", "children": [{"text": "alt dal", "children": []}]}]}}';

export interface MapGenOptions {
  brief: string;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export async function generateMap(opts: MapGenOptions): Promise<CraftMap> {
  const sys =
    "Sen kıdemli bir bilgi mimarı ve eğitmensin. Kullanıcının brief'inden TÜRKÇE bir zihin haritası " +
    "(kroki) üret. SADECE geçerli JSON döndür (istersen tek ```json bloğu) — açıklama yazma. Şema:\n" +
    MAP_SCHEMA + "\n" +
    `Kurallar: merkezde TEK kavram; 3-6 ana dal; gerekli yerde 2-5 alt dal (en çok ${MAX_MAP_DEPTH} seviye); ` +
    `düğüm metinleri KISA (2-6 kelime, en çok ${MAX_NODE_TEXT} karakter); toplam ${MAX_MAP_NODES} düğümü aşma; ` +
    "bilgi uydurma, brief'in kapsamında kal.";
  const map = await streamJson({
    system: sys, messages: [{ role: "user", content: opts.brief }],
    onDelta: opts.onDelta, signal: opts.signal, temperature: 0.5,
    maxTokens: MAP_MAX_TOKENS,
    parse: (raw) => parseMapJson(raw, opts.brief.slice(0, 48)),
  });
  map.brief = opts.brief;
  return map;
}

/** Seçili düğümü AI ile dallandırır: yalnız YENİ çocuk metinleri döner. */
export async function expandNode(map: CraftMap, nodeId: string, signal?: AbortSignal): Promise<string[]> {
  const node = findNode(map.root, nodeId);
  if (!node) throw new Error("Düğüm bulunamadı.");
  const sys =
    'Bir zihin haritası düğümünü dallandırıyorsun. SADECE JSON döndür: {"children": ["kısa metin", ...]} — ' +
    "3-6 öğe, her biri 2-6 kelime, TÜRKÇE. Mevcut dalları TEKRARLAMA.";
  const user =
    `Harita: ${map.title}\nDüğüm: ${node.text}\n` +
    `Mevcut alt dallar: ${node.children.map((c) => c.text).join(", ") || "(yok)"}\n` +
    (map.brief ? `Bağlam: ${map.brief.slice(0, 500)}` : "");
  const texts = await streamJson({
    system: sys, messages: [{ role: "user", content: user }], signal, temperature: 0.6,
    maxTokens: MAP_EXPAND_MAX_TOKENS,
    parse: (full) => {
      let raw: unknown;
      try { raw = JSON.parse(extractJsonObject(full)); } catch { throw new Error("Dallandırma JSON'u bozuk — tekrar dene."); }
      const arr = (raw && typeof raw === "object" && Array.isArray((raw as { children?: unknown }).children))
        ? ((raw as { children: unknown[] }).children)
        : [];
      const out = arr
        .filter((t): t is string => typeof t === "string" && !!t.trim())
        .map((t) => t.trim().slice(0, MAX_NODE_TEXT))
        .slice(0, MAX_NODE_CHILDREN);
      if (!out.length) throw new Error("Dallandırma geçersiz — tekrar dene.");
      return out;
    },
  });
  return texts;
}
