import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Ö11 (kullanıcı kararı, Tem 2026): sohbet composer'ındaki dosya ekleme
   menüsünde üç öğe vardı — "Dosya ekle", "Görsel ekle", "Fotoğraf çek" —
   oysa üçü de AYNI huniye (readFileIntoInput) giriyordu. Artık tek bir
   ataç düğmesi var ve doğrudan dosya seçiciyi açıyor.

   Bu test kaynak metni okur: composer JSX'i React/DOM gerektirir ve bu
   projenin testleri jsdom kullanmaz (`environment: node`). Buradaki amaç
   kararı ve accept listesinin KAPSAMINI kilitlemek. */

const src = readFileSync(join(process.cwd(), "src/components/CoderView.tsx"), "utf8");

describe("composer dosya ekleme — tek düğme (Ö11)", () => {
  /* Menü ÖĞELERİ aranıyor (label=…), çıplak metin değil: kaldırma kararını
     anlatan yorum satırları bu isimleri kaçınılmaz olarak içeriyor. */
  it("ayrı 'Görsel ekle' / 'Fotoğraf çek' menü öğeleri kaldırıldı", () => {
    expect(src).not.toMatch(/label="Görsel ekle"/);
    expect(src).not.toMatch(/label="Fotoğraf çek"/);
    expect(src).not.toContain("CameraCaptureModal");
    expect(src).not.toContain("imgRef");
    expect(src).not.toContain("cameraRef");
  });

  it("tek bir dosya girişi var", () => {
    expect(src.match(/type="file"/g) ?? []).toHaveLength(1);
    expect(src.match(/ref=\{fileRef\}/g) ?? []).toHaveLength(1);
  });

  it("accept listesi görselleri DE kapsar (yoksa görsel eklenemezdi)", () => {
    const m = src.match(/<input ref=\{fileRef\}[^>]*accept="([^"]+)"/);
    expect(m).toBeTruthy();
    const accept = m![1];
    expect(accept).toContain("image/*");
    /* Var olan belge desteği KORUNMALI — huninin PDF/Office/ipynb çıkarım
       yolları bu uzantılara bağlı. */
    for (const ext of [".pdf", ".docx", ".xlsx", ".pptx", ".ipynb", ".csv", ".md", ".ts"]) {
      expect(accept).toContain(ext);
    }
  });
});

/* Ö8 — panellerin Araçlar menüsünde GERÇEKTEN listelendiğini kilitler.
   (Sidebar JSX'i React/DOM gerektiriyor; bu proje jsdom kullanmıyor.) */
describe("Araçlar menüsü — Dosyalar/Sunucu girişleri (Ö8)", () => {
  const sidebar = readFileSync(join(process.cwd(), "src/components/Sidebar.tsx"), "utf8");

  it("iki panel de Araçlar öğesi olarak var", () => {
    expect(sidebar).toContain('label: "Dosyalar (depo)"');
    expect(sidebar).toContain('label: "Sunucu (workspace)"');
  });

  it("mevcut saf yardımcıyı kullanan store eylemine bağlılar", () => {
    expect(sidebar).toContain('toggleLeftPanelState("files")');
    expect(sidebar).toContain('toggleLeftPanelState("workspace")');
  });

  it("CoderView paneli artık yerel state'te değil, store'dan okuyor", () => {
    expect(src).toContain("useStore((s) => s.leftPanel)");
    expect(src).not.toMatch(/useState<LeftPanel>/);
  });
});
