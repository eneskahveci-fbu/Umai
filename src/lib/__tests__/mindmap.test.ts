import { describe, it, expect } from "vitest";
import {
  addChild, countNodes, deleteNode, findNode, layoutMap, mapToMarkdown, mapToSvg,
  MAX_MAP_DEPTH, MAX_NODE_CHILDREN, newNode, normalizeMap, parseMapJson, updateNodeText,
} from "../mindmap";
import type { MindNode } from "../types";

const rawValid = {
  title: "Kahve Dükkânı",
  root: {
    text: "Kahve dükkânı planı",
    children: [
      { text: "Konum", children: [{ text: "Yaya trafiği", children: [] }] },
      { text: "Bütçe", children: [] },
    ],
  },
};

describe("normalizeMap / parseMapJson", () => {
  it("geçerli ağacı normalize eder: id atar, metni kırpar", () => {
    const m = normalizeMap(rawValid)!;
    expect(m.title).toBe("Kahve Dükkânı");
    expect(m.root.children.length).toBe(2);
    expect(m.root.children[0].children[0].text).toBe("Yaya trafiği");
    expect(m.root.id).toMatch(/^mn_/);
  });

  it("çocuksuz kök / bozuk girdi null döner", () => {
    expect(normalizeMap({ title: "x", root: { text: "yalnız", children: [] } })).toBeNull();
    expect(normalizeMap("çöp")).toBeNull();
  });

  it("derinlik ve dal sınırlarını uygular", () => {
    // 6 seviyelik zincir → MAX_MAP_DEPTH'te kesilir
    let deep: { text: string; children: unknown[] } = { text: "dip", children: [] };
    for (let i = 0; i < 6; i++) deep = { text: `s${i}`, children: [deep] };
    const m = normalizeMap({ root: deep })!;
    let depth = 0, n: MindNode = m.root;
    while (n.children.length) { n = n.children[0]; depth++; }
    expect(depth).toBe(MAX_MAP_DEPTH);
    // 12 çocuk → MAX_NODE_CHILDREN'a kesilir
    const wide = normalizeMap({
      root: { text: "kök", children: Array.from({ length: 12 }, (_, i) => ({ text: `d${i}`, children: [] })) },
    })!;
    expect(wide.root.children.length).toBe(MAX_NODE_CHILDREN);
  });

  it("parseMapJson ```json bloğunu ayıklar", () => {
    const m = parseMapJson("İşte:\n```json\n" + JSON.stringify(rawValid) + "\n```");
    expect(m.root.children.length).toBe(2);
  });
});

describe("ağaç yardımcıları", () => {
  const m = normalizeMap(rawValid)!;

  it("findNode / countNodes", () => {
    expect(countNodes(m.root)).toBe(4);
    expect(findNode(m.root, m.root.children[1].id)?.text).toBe("Bütçe");
    expect(findNode(m.root, "yok")).toBeNull();
  });

  it("updateNodeText yeni kök döndürür, hedefi günceller", () => {
    const next = updateNodeText(m.root, m.root.children[0].id, "Yer seçimi");
    expect(findNode(next, m.root.children[0].id)?.text).toBe("Yer seçimi");
    expect(m.root.children[0].text).toBe("Konum"); // orijinal değişmez
  });

  it("addChild ekler; deleteNode alt ağacıyla siler, kökü silmez", () => {
    const child = newNode("Kira");
    const next = addChild(m.root, m.root.children[1].id, child);
    expect(findNode(next, child.id)?.text).toBe("Kira");
    const afterDel = deleteNode(next, m.root.children[0].id);
    expect(findNode(afterDel, m.root.children[0].id)).toBeNull();
    expect(countNodes(afterDel)).toBe(3); // kök + Bütçe + Kira ("Yaya trafiği" de gitti)
    expect(deleteNode(afterDel, afterDel.id)).toBe(afterDel); // kök silinemez
  });
});

describe("layoutMap / dışa aktarma", () => {
  const m = normalizeMap(rawValid)!;

  it("yerleşim: her düğüm konumlanır, çocuk hep sağda, kenar sayısı = düğüm-1", () => {
    const l = layoutMap(m.root);
    expect(l.nodes.length).toBe(4);
    expect(l.edges.length).toBe(3);
    const byId = new Map(l.nodes.map((n) => [n.id, n]));
    const walk = (n: MindNode) => {
      for (const c of n.children) {
        expect(byId.get(c.id)!.x).toBeGreaterThan(byId.get(n.id)!.x + byId.get(n.id)!.w - 1);
        walk(c);
      }
    };
    walk(m.root);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });

  it("layoutMap uzun metni İKİ SATIRA sarar — mapToSvg ile React tuvali AYNI satırları paylaşır", () => {
    /* ÖNCEDEN: yalnız MapStudio.tsx'in kendi JSX'i 30 karakterden uzun metni
       kısaltıyordu; mapToSvg TAM metni basıyordu — düğüm genişliği 240px'te
       tavan yaptığından (nodeWidth) dışa aktarılan/yayınlanan SVG'de uzun
       (MAX_NODE_TEXT=80'e kadar geçerli) metin kutudan taşıyordu. Sonra tek
       satırlık 30-karakter kırpması geldi; o da meşru düğümleri kelime
       ortasından kesiyordu. Artık sarma layoutMap'te TEK yerde hesaplanıyor
       ve iki satıra kadar yayılıyor. */
    const longText = "Bu çok ama çok uzun bir düğüm metni örneğidir kesinlikle";
    const longMap = normalizeMap({ title: "T", root: { text: "kök", children: [{ text: longText, children: [] }] } })!;
    const l = layoutMap(longMap.root);
    const child = l.nodes.find((n) => n.text === longText)!;
    expect(child.lines.length).toBe(2);
    expect(child.lines.at(-1)!.endsWith("…")).toBe(true); // sığmayan kuyruk işaretlenir
    expect(longText.startsWith(child.lines[0])).toBe(true); // kelime sınırında bölünür
    expect(child.h).toBe(48); // iki satırlık kutu yükselir

    const svg = mapToSvg(longMap);
    for (const line of child.lines) expect(svg).toContain(line);
    expect(svg).not.toContain(longText); // tam metin SVG'ye asla girmemeli
  });

  it("kısa metin tek satırda kalır ve kutu yüksekliği değişmez", () => {
    const m = normalizeMap({ title: "T", root: { text: "kök", children: [{ text: "Kısa dal", children: [] }] } })!;
    const child = layoutMap(m.root).nodes.find((n) => n.text === "Kısa dal")!;
    expect(child.lines).toEqual(["Kısa dal"]);
    expect(child.h).toBe(32);
  });

  it("iki satırlık düğümler komşularıyla dikey olarak ÇAKIŞMAZ", () => {
    /* Eski sabit 46px'lik satır ızgarası 48px'lik iki satırlık kutuyla
       çakışıyordu; yerleşim artık yükseklik-farkındalı bir imleç kullanıyor. */
    const m = normalizeMap({
      title: "T",
      root: { text: "kök", children: [
        { text: "Konumlandırma ve mesajlaşma stratejisi", children: [] },
        { text: "Ölçümleme ve raporlama altyapısının kurulması", children: [] },
        { text: "Kısa", children: [] },
      ] },
    })!;
    const leaves = layoutMap(m.root).nodes.filter((n) => n.depth === 1).sort((a, b) => a.y - b.y);
    for (let i = 1; i < leaves.length; i++) {
      expect(leaves[i].y).toBeGreaterThanOrEqual(leaves[i - 1].y + leaves[i - 1].h);
    }
  });

  it("mapToSvg bağımsız SVG üretir (başlık + tüm düğüm metinleri, XSS kaçışlı)", () => {
    const evil = normalizeMap({ title: "T", root: { text: "<script>kök", children: [{ text: "dal & alt", children: [] }] } })!;
    const svg = mapToSvg(evil);
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg).toContain("&lt;script&gt;kök");
    expect(svg).toContain("dal &amp; alt");
    expect(svg).not.toContain("<script>");
  });

  it("mapToMarkdown girintili taslak üretir", () => {
    const md = mapToMarkdown(m);
    expect(md).toContain("# Kahve Dükkânı");
    expect(md).toContain("**Kahve dükkânı planı**");
    expect(md).toContain("- Konum");
    expect(md).toContain("  - Yaya trafiği");
  });
});
