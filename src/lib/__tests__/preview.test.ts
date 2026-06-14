import { describe, it, expect } from "vitest";
import { buildPreview, parseBlocks } from "../preview";

describe("buildPreview", () => {
  it("HTML bloğunu önizler ve CSS/JS'i enjekte eder", () => {
    const md = "```html\n<div id=x>hi</div>\n```\n```css\n#x{color:red}\n```\n```js\nconsole.log(1)\n```";
    const a = buildPreview(md);
    expect(a?.type).toBe("html");
    expect(a?.content).toContain("<div id=x>hi</div>");
    expect(a?.content).toContain("#x{color:red}");
    expect(a?.content).toContain("console.log(1)");
  });

  it("React/JSX bloğunu canlı önizlemeye çevirir (CDN + mount)", () => {
    const md = "```jsx\nfunction App(){return <h1>Merhaba</h1>;}\n```";
    const a = buildPreview(md);
    expect(a?.type).toBe("html");
    expect(a?.title).toBe("React Önizleme");
    expect(a?.content).toContain("babel");
    expect(a?.content).toContain("React.createElement(App)");
  });

  it("export default'lu bileşeni temizleyip mount eder", () => {
    const md = "```tsx\nexport default function Dashboard(){return <div/>;}\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("React.createElement(Dashboard)");
    expect(a?.content).not.toContain("export default");
  });

  it("düz JS'i çalıştırılabilir HTML'e sarar", () => {
    const a = buildPreview("```js\ndocument.body.textContent='x'\n```");
    expect(a?.type).toBe("html");
    expect(a?.title).toBe("JS Önizleme");
    expect(a?.content).toContain("document.body.textContent='x'");
  });

  it("SVG ve mermaid'i doğru türle döndürür", () => {
    expect(buildPreview("```svg\n<svg></svg>\n```")?.type).toBe("svg");
    expect(buildPreview("```mermaid\ngraph TD;A-->B\n```")?.type).toBe("mermaid");
  });

  it("önizlenemeyen kod için null döner", () => {
    expect(buildPreview("```python\nprint(1)\n```")).toBeNull();
    expect(buildPreview("kod yok")).toBeNull();
  });

  it("</script> enjeksiyonunu kaçar", () => {
    const a = buildPreview("```js\nvar s='</script>'\n```");
    expect(a?.content).not.toContain("'</script>'");
    expect(a?.content).toContain("<\\/script>");
  });

  it("parseBlocks dil + kodu ayıklar", () => {
    const blocks = parseBlocks("```ts:app.ts\nconst x=1\n```");
    expect(blocks[0].lang).toBe("ts");
    expect(blocks[0].code).toContain("const x=1");
  });
});
