import { describe, expect, it } from "vitest";
import { clamp01, emptyHist, nudge, pushHist, redoHist, undoHist } from "../design";
import type { Design } from "../design";

const page = (text: string): Design => ({
  fmt: "slide", w: 1280, h: 720, bgType: "gradient", c1: "#000", c2: "#fff", bgImage: "",
  layers: [{ id: "a", text, x: 0.5, y: 0.5, size: 60, color: "#fff", weight: 700, align: "center", font: "Arial" }],
});

describe("nudge + clamp01", () => {
  it("konumu kaydırır ve 0-1'e kelepçeler", () => {
    const l = { x: 0.98, y: 0.01 };
    const n = nudge(l, 0.05, -0.05);
    expect(n.x).toBe(1);
    expect(n.y).toBe(0);
  });
  it("clamp01 NaN'ı 0.5'e düşürür", () => {
    expect(clamp01(NaN)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });
});

describe("history (undo/redo)", () => {
  it("push → undo eski durumu döndürür, redo geri getirir", () => {
    const v1 = [page("bir")], v2 = [page("iki")];
    let h = pushHist(emptyHist(), v1); // v1 → v2 değişimi öncesi kayıt
    const u = undoHist(h, v2);
    expect(u).not.toBeNull();
    expect(u!.pages[0].layers[0].text).toBe("bir");
    h = u!.hist;
    const r = redoHist(h, u!.pages);
    expect(r!.pages[0].layers[0].text).toBe("iki");
  });
  it("boş geçmişte undo/redo null döner", () => {
    expect(undoHist(emptyHist(), [page("x")])).toBeNull();
    expect(redoHist(emptyHist(), [page("x")])).toBeNull();
  });
  it("push redo dalını temizler", () => {
    let h = pushHist(emptyHist(), [page("bir")]);
    h = undoHist(h, [page("iki")])!.hist;
    expect(h.future.length).toBe(1);
    h = pushHist(h, [page("üç")]);
    expect(h.future.length).toBe(0);
  });
  it("ardışık birebir aynı anlık görüntü tekrar kaydedilmez", () => {
    let h = pushHist(emptyHist(), [page("aynı")]);
    h = pushHist(h, [page("aynı")]);
    expect(h.past.length).toBe(1);
  });
  it("geçmiş üst sınırı aşmaz", () => {
    let h = emptyHist();
    for (let i = 0; i < 60; i++) h = pushHist(h, [page(`s${i}`)], 50);
    expect(h.past.length).toBe(50);
    expect(h.past[49][0].layers[0].text).toBe("s59");
  });
  it("anlık görüntüler derin kopyadır (sonradan mutasyon sızmaz)", () => {
    const v1 = [page("orijinal")];
    const h = pushHist(emptyHist(), v1);
    v1[0].layers[0].text = "bozuldu";
    expect(h.past[0][0].layers[0].text).toBe("orijinal");
  });
});
