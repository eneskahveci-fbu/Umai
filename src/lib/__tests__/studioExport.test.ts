import { describe, it, expect, vi, afterEach } from "vitest";
import { printDeckPdf } from "../studioExport";

/* printDeckPdf() — sunum (deck) PDF dışa aktarımı, printPdf()'ten farklı
   olarak deckToHtml() çıktısını sandboxed-iframe sarmalayıcı OLMADAN
   doğrudan üst seviye yazar (bkz. studioExport.ts'teki gerekçe: nested
   iframe'de @media print sayfa-sonu kuralları PDF çıktısında çalışmıyordu). */
describe("printDeckPdf", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeWindow() {
    return {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
    };
  }

  it("pop-up engellenirse false döner, hiçbir şey yazmaz", () => {
    vi.stubGlobal("window", { open: vi.fn(() => null) });
    expect(printDeckPdf("<html><body>x</body></html>")).toBe(false);
  });

  it("deck HTML'ini sandbox iframe sarmalayıcı OLMADAN doğrudan yazar", () => {
    const w = fakeWindow();
    vi.stubGlobal("window", { open: vi.fn(() => w) });
    printDeckPdf("<html><body><h1>Slayt</h1></body></html>");
    expect(w.document.open).toHaveBeenCalled();
    expect(w.document.close).toHaveBeenCalled();
    const written = w.document.write.mock.calls[0]![0] as string;
    expect(written).toContain("<h1>Slayt</h1>");
    expect(written).not.toContain("sandbox=");
    expect(written).not.toContain("<iframe");
  });

  it("otomatik yazdırma script'i ekler (</body> öncesine)", () => {
    const w = fakeWindow();
    vi.stubGlobal("window", { open: vi.fn(() => w) });
    printDeckPdf("<html><body><h1>Slayt</h1></body></html>");
    const written = w.document.write.mock.calls[0]![0] as string;
    expect(written).toContain("window.print()");
    expect(written.indexOf("window.print()")).toBeLessThan(written.indexOf("</body>"));
  });

  it("</body> yoksa bile çökmez, script'i sona ekler", () => {
    const w = fakeWindow();
    vi.stubGlobal("window", { open: vi.fn(() => w) });
    printDeckPdf("<div>gövde etiketsiz içerik</div>");
    const written = w.document.write.mock.calls[0]![0] as string;
    expect(written).toContain("gövde etiketsiz içerik");
    expect(written).toContain("window.print()");
  });
});
