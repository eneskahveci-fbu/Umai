import { describe, expect, it } from "vitest";
import { buildStudioProjectFromArtifact, withStudioProject } from "../studioHandoff";
import type { Artifact, StudioProject } from "../types";

/* N1 — sohbetteki artifact'ı Tasarım Stüdyosu'nda açıp devam ettirme. */

const html: Artifact = { type: "html", content: "<h1>Merhaba</h1>", title: "Açılış Sayfası" };

describe("buildStudioProjectFromArtifact", () => {
  it("artifact içeriğini ve türünü projeye taşır", () => {
    const p = buildStudioProjectFromArtifact(html);
    expect(p.html).toBe("<h1>Merhaba</h1>");
    expect(p.artifactType).toBe("html");
    expect(p.name).toBe("Açılış Sayfası");
  });

  it("versions DOLU başlar — DesignStudio.openSavedProject setVersionIndex(length-1) yapıyor", () => {
    const p = buildStudioProjectFromArtifact(html);
    expect(p.versions).toEqual(["<h1>Merhaba</h1>"]);
    /* Boş dizide indeks -1 olur ve sürüm göstergesi bozulurdu. */
    expect((p.versions ?? []).length - 1).toBe(0);
  });

  it("başlıksız artifact'a anlamlı bir ad verir", () => {
    const p = buildStudioProjectFromArtifact({ type: "svg", content: "<svg/>", title: "" });
    expect(p.name).toBe("Sohbetten gelen tasarım");
  });

  it("kod artifact'ında dili korur, dilsizde alanı hiç eklemez", () => {
    const withLang = buildStudioProjectFromArtifact({ type: "code", content: "print(1)", title: "S", language: "python" });
    expect(withLang.artifactLanguage).toBe("python");
    expect("artifactLanguage" in buildStudioProjectFromArtifact(html)).toBe(false);
  });

  it("her çağrıda benzersiz id üretir", () => {
    const ids = new Set(Array.from({ length: 20 }, () => buildStudioProjectFromArtifact(html).id));
    expect(ids.size).toBe(20);
  });

  it("brief verilirse kırpılarak taşınır, verilmezse boş kalır", () => {
    expect(buildStudioProjectFromArtifact(html, "  bir açılış sayfası  ").brief).toBe("bir açılış sayfası");
    expect(buildStudioProjectFromArtifact(html).brief).toBe("");
  });
});

describe("withStudioProject", () => {
  function proj(id: string): StudioProject {
    return { ...buildStudioProjectFromArtifact(html), id };
  }

  it("yeni projeyi listenin BAŞINA ekler (en son açılan en üstte)", () => {
    const out = withStudioProject([proj("a"), proj("b")], proj("yeni"));
    expect(out.map((p) => p.id)).toEqual(["yeni", "a", "b"]);
  });

  it("aynı id varsa çoğaltmaz, günceller", () => {
    const out = withStudioProject([proj("a"), proj("b")], proj("a"));
    expect(out.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("liste boş/tanımsızken de çalışır", () => {
    expect(withStudioProject(undefined, proj("x")).map((p) => p.id)).toEqual(["x"]);
  });

  it("40'lık üst sınırı korur (DesignStudio'nun kendi sınırıyla aynı)", () => {
    const existing = Array.from({ length: 40 }, (_, i) => proj(`p${i}`));
    const out = withStudioProject(existing, proj("yeni"));
    expect(out).toHaveLength(40);
    expect(out[0].id).toBe("yeni");
    expect(out.some((p) => p.id === "p39")).toBe(false); // en eski düştü
  });
});
