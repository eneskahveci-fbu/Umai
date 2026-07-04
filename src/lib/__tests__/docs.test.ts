import { describe, it, expect } from "vitest";
import { docToHtml, docToMarkdown, MAX_DOC_BLOCKS, newBlock, normalizeDoc, parseDocJson } from "../docs";
import type { CraftDoc } from "../types";

describe("normalizeDoc / parseDocJson", () => {
  const valid = JSON.stringify({
    title: "Rehber",
    blocks: [
      { type: "h1", text: "Giriş" },
      { type: "p", text: "Paragraf" },
      { type: "todo", text: "Yap", checked: true },
      { type: "olmayan", text: "p'ye düşer" },
      { type: "p", text: "   " },          // boş → elenir
      { type: "divider", text: "" },        // divider boş metinle geçerli
    ],
  });

  it("geçerli dokümanı kurar, boş bloğu eler, bilinmeyen türü p yapar", () => {
    const doc = parseDocJson(valid);
    expect(doc.title).toBe("Rehber");
    expect(doc.blocks).toHaveLength(5);
    expect(doc.blocks[2].checked).toBe(true);
    expect(doc.blocks[3].type).toBe("p");
    expect(doc.blocks[4].type).toBe("divider");
  });

  it(`blok sayısını ${MAX_DOC_BLOCKS} ile sınırlar`, () => {
    const many = { title: "Çok", blocks: Array.from({ length: 200 }, (_, i) => ({ type: "p", text: `B${i}` })) };
    expect(normalizeDoc(many)?.blocks).toHaveLength(MAX_DOC_BLOCKS);
  });

  it("bozuk girdide anlaşılır hata fırlatır", () => {
    expect(() => parseDocJson("json yok")).toThrow();
    expect(() => parseDocJson('{"title":"x","blocks":[]}')).toThrow();
  });
});

function sampleDoc(): CraftDoc {
  return {
    id: "d1", title: "Test & <Doc>",
    blocks: [
      { id: "b1", type: "h2", text: "Bölüm <script>" },
      { id: "b2", type: "bullet", text: "madde bir" },
      { id: "b3", type: "bullet", text: "madde iki" },
      { id: "b4", type: "todo", text: "işi bitir", checked: true },
      { id: "b5", type: "code", text: "const a = 1;" },
    ],
    createdAt: 0, updatedAt: 0,
  };
}

describe("docToMarkdown", () => {
  it("blok türlerini doğru Markdown'a çevirir", () => {
    const md = docToMarkdown(sampleDoc());
    expect(md).toContain("# Test & <Doc>");
    expect(md).toContain("## Bölüm <script>");
    expect(md).toContain("- madde bir");
    expect(md).toContain("- [x] işi bitir");
    expect(md).toContain("```\nconst a = 1;\n```");
  });
});

describe("docToHtml", () => {
  it("HTML'i kaçırır ve ardışık maddeleri tek listede toplar", () => {
    const html = docToHtml(sampleDoc());
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain("checked");
  });
});

describe("newBlock", () => {
  it("todo bloğu checked=false ile başlar", () => {
    expect(newBlock("todo").checked).toBe(false);
    expect(newBlock("p").checked).toBeUndefined();
  });
});
