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

  it("B1: çok-satırlı import'u temizler (kırık sözdizimi bırakmaz)", () => {
    const md = "```jsx\nimport React, {\n  useState,\n  useEffect,\n} from 'react';\nimport './styles.css';\nfunction App(){return <h1>Hi</h1>;}\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("React.createElement(App)");
    /* import satırlarının hiçbir parçası kaynağa sızmamalı. */
    expect(a?.content).not.toContain("from 'react'");
    expect(a?.content).not.toContain("useState,\n  useEffect");
    expect(a?.content).not.toContain("import './styles.css'");
  });

  it("B2: son büyük-harfli SABİT bileşen sanılmaz", () => {
    const md = "```jsx\nfunction Widget(){return <div/>;}\nconst COLORS = ['red','blue'];\n```";
    const a = buildPreview(md);
    /* COLORS bir dizi → bileşen değil; gerçek bileşen Widget mount edilmeli. */
    expect(a?.content).toContain("React.createElement(Widget)");
    expect(a?.content).not.toContain("React.createElement(COLORS)");
  });

  it("B2: ok-fonksiyonu const bileşeni algılanır", () => {
    const md = "```jsx\nconst App = () => <h1>Ok</h1>;\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("React.createElement(App)");
  });

  it("B3: saf TS (generic'li, JSX'siz) React sanılmaz → önizlenmez", () => {
    const md = "```ts\nconst m = new Map<string, number>();\nfunction sum(a: Array<number>){return a.reduce((x,y)=>x+y,0);}\n```";
    const a = buildPreview(md);
    /* JSX yok → React adayı değil; başka önizlenebilir blok da yok → null. */
    expect(a).toBeNull();
  });

  it("B3: JSX içeren TS bloğu yine önizlenir", () => {
    const md = "```ts\nconst App = () => <h1>x</h1>;\n```";
    const a = buildPreview(md);
    expect(a?.title).toBe("React Önizleme");
  });

  it("B4: yaygın React 18 hook'ları çıplak kullanılabilir (destructuring enjekte)", () => {
    const a = buildPreview("```jsx\nfunction App(){return <div/>;}\n```");
    expect(a?.content).toContain("useLayoutEffect");
    expect(a?.content).toContain("useId");
    expect(a?.content).toContain("=React;");
  });

  it("B5: CSS içindeki </style> kaçırılır", () => {
    const md = "```html\n<div>x</div>\n```\n```css\n.a::after{content:'</style>'}\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("<\\/style>");
    expect(a?.content).not.toContain("content:'</style>'");
  });
});

describe("çok dosyalı yanıtlarda doğru bileşen seçimi", () => {
  it("layout.tsx (kendi <html> etiketi) yerine SONRAKİ gerçek bileşeni seçer", () => {
    const md =
      "```tsx\nexport default function RootLayout({children}){return <html><body>{children}</body></html>;}\n```\n" +
      "```tsx\nfunction App(){return <h1>Gerçek sayfa</h1>;}\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("React.createElement(App)");
    expect(a?.content).not.toContain("RootLayout");
  });

  it("YALNIZ <html> içeren bir blok varsa net bir açıklama gösterir (sessiz boş render yerine)", () => {
    const md = "```tsx\nexport default function RootLayout({children}){return <html><body>{children}</body></html>;}\n```";
    const a = buildPreview(md);
    expect(a?.type).toBe("html");
    expect(a?.content).toContain("layout.tsx");
    expect(a?.content).not.toContain("ReactDOM.createRoot");
  });

  it("tek (html içermeyen) bileşende davranış değişmez", () => {
    const md = "```tsx\nfunction App(){return <h1>Tek dosya</h1>;}\n```";
    const a = buildPreview(md);
    expect(a?.content).toContain("React.createElement(App)");
  });
});

describe("gömülü console paneli (sandbox)", () => {
  it("React önizlemesine console panelini gömer", () => {
    const a = buildPreview("```jsx\nfunction App(){return <div/>;}\n```");
    expect(a?.content).toContain('id="__cns"');
    expect(a?.content).toContain("console[k]");
  });
  it("JS önizlemesine console panelini gömer", () => {
    const a = buildPreview("```js\nconsole.log('x')\n```");
    expect(a?.content).toContain('id="__cns"');
  });
  it("düz HTML önizlemesine console panelini gömer", () => {
    const a = buildPreview("```html\n<p>selam</p>\n```");
    expect(a?.content).toContain('id="__cns"');
  });
  it("yakalanmayan hataları ve promise reddini dinler", () => {
    const a = buildPreview("```js\nx()\n```");
    expect(a?.content).toContain("addEventListener('error'");
    expect(a?.content).toContain("unhandledrejection");
  });
});

