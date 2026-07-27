import { describe, expect, it } from "vitest";
import { toggleLeftPanel, switchLeftPanel } from "../leftPanel";

/* Tem 2026 — "Çalışma" sekmesindeki Dosyalar (depo) ve Sunucu (workspace)
   panelleri aynı konumda render ediliyor ama bağımsız boolean'dı; ikisi de
   teorik olarak aynı anda açık kalabilirdi. Artık en fazla biri açık. */

describe("toggleLeftPanel — menüden tıklama (aç/kapat)", () => {
  it("kapalıyken tıklanan paneli açar", () => {
    expect(toggleLeftPanel(null, "files")).toBe("files");
    expect(toggleLeftPanel(null, "workspace")).toBe("workspace");
  });

  it("zaten açık olan panele tekrar tıklamak kapatır", () => {
    expect(toggleLeftPanel("files", "files")).toBeNull();
    expect(toggleLeftPanel("workspace", "workspace")).toBeNull();
  });

  it("DİĞER panel açıkken tıklamak ona geçer — ikisi asla birlikte açık olmaz", () => {
    expect(toggleLeftPanel("workspace", "files")).toBe("files");
    expect(toggleLeftPanel("files", "workspace")).toBe("workspace");
  });
});

describe("switchLeftPanel — panel içi 'diğerine geç' düğmesi", () => {
  it("her zaman hedef paneli açar (idempotent)", () => {
    expect(switchLeftPanel("workspace")).toBe("workspace");
    expect(switchLeftPanel("files")).toBe("files");
  });
});
