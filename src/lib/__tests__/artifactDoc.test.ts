import { describe, expect, it } from "vitest";
import { buildArtifactSrcDoc, withAnnotationScript, artifactDownload } from "../artifactDoc";

/* Claude Artifacts paritesi (code/markdown türleri) regresyon testleri —
   önizleme belgesi kurulumu, HTML-escape güvenliği ve indirme uzantıları. */

describe("buildArtifactSrcDoc — code", () => {
  it("sözdizimi vurgulama iskeletini dille kurar", () => {
    const doc = buildArtifactSrcDoc("code", "print('merhaba')", "python");
    expect(doc).toContain("highlight.js");
    expect(doc).toContain('class="language-python"');
    expect(doc).toContain("print(&#39;merhaba&#39;)".replace(/&#39;/g, "'")); // içerik korunur
  });
  it("dil verilmezse plaintext'e düşer", () => {
    expect(buildArtifactSrcDoc("code", "x = 1")).toContain('class="language-plaintext"');
  });
  it("HTML içeren kodu escape eder (iframe kırılmaz)", () => {
    const doc = buildArtifactSrcDoc("code", "const s = '</script><img src=x onerror=alert(1)>';", "javascript");
    expect(doc).not.toContain("</script><img");
    expect(doc).toContain("&lt;/script&gt;");
  });
});

describe("buildArtifactSrcDoc — markdown", () => {
  it("belge görünümünü marked ile kurar ve kaynağı gömer", () => {
    const doc = buildArtifactSrcDoc("markdown", "# Başlık\n\nMetin");
    expect(doc).toContain("marked");
    expect(doc).toContain("# Başlık");
    expect(doc).toContain('id="doc"');
  });
  it("markdown içindeki ham HTML'i escape ederek taşır", () => {
    const doc = buildArtifactSrcDoc("markdown", "önce </div><script>alert(1)</script> sonra");
    expect(doc).not.toContain("<script>alert(1)</script>");
    expect(doc).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("buildArtifactSrcDoc — mevcut türler değişmedi", () => {
  it("html: tam belge olduğu gibi geçer", () => {
    const full = "<html><body>selam</body></html>";
    expect(buildArtifactSrcDoc("html", full)).toBe(full);
  });
  it("html: parça belgeye sarılır", () => {
    expect(buildArtifactSrcDoc("html", "<p>hi</p>")).toContain("<!DOCTYPE html>");
  });
  it("svg ve mermaid kendi iskeletlerini kullanır", () => {
    expect(buildArtifactSrcDoc("svg", "<svg/>")).toContain("place-items:center");
    expect(buildArtifactSrcDoc("mermaid", "graph TD; A-->B")).toContain("mermaid.initialize");
  });
});

describe("withAnnotationScript — İşaretle & Değiştir", () => {
  it("script'i SON </body>'den hemen önce enjekte eder", () => {
    const doc = buildArtifactSrcDoc("html", "<p>hi</p>");
    const out = withAnnotationScript(doc);
    expect(out).toContain("__umaiAnnotate");
    expect(out.lastIndexOf("__umaiAnnotate")).toBeLessThan(out.lastIndexOf("</body>"));
  });
  it("</body> yoksa sona ekler", () => {
    const out = withAnnotationScript("<div>parça</div>");
    expect(out.endsWith("</script>")).toBe(true);
    expect(out).toContain("__umaiAnnotate");
  });
  it("buildArtifactSrcDoc'un kendisi script İÇERMEZ (yayınlanan sayfa temiz kalır)", () => {
    expect(buildArtifactSrcDoc("html", "<p>hi</p>")).not.toContain("__umaiAnnotate");
    expect(buildArtifactSrcDoc("svg", "<svg/>")).not.toContain("__umaiAnnotate");
  });
  it("içerikteki sahte </body> yerine gerçek (son) kapanışı hedefler", () => {
    const doc = `<html><body><code>&lt;/body&gt; örneği</code><p id="son">bitiş</p></body></html>`;
    const out = withAnnotationScript(doc);
    const scriptIdx = out.indexOf("__umaiAnnotate");
    expect(scriptIdx).toBeGreaterThan(out.indexOf('id="son"'));
  });
});

describe("artifactDownload — uzantılar", () => {
  it.each([
    ["python", "py"], ["typescript", "ts"], ["go", "go"], ["c++", "cpp"],
    ["sql", "sql"], ["bilinmeyen-dil", "txt"],
  ])("code + %s → .%s", (language, ext) => {
    expect(artifactDownload("code", "x", language).ext).toBe(ext);
  });
  it("markdown → .md, ham içerik", () => {
    const { ext, body } = artifactDownload("markdown", "# Doc");
    expect(ext).toBe("md");
    expect(body).toBe("# Doc");
  });
  it("code gövdesi ham kalır (önizleme iskeleti eklenmez)", () => {
    expect(artifactDownload("code", "print(1)", "python").body).toBe("print(1)");
  });
  it("html gövdesi tam belgeye tamamlanır", () => {
    expect(artifactDownload("html", "<p>hi</p>").body).toContain("<!DOCTYPE html>");
  });
});
