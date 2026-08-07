import { describe, expect, it } from "vitest";
import { planRewind, planTouchesFiles } from "../rewind";
import type { ChatMessage } from "../types";

const user = (content: string): ChatMessage => ({ role: "user", content });
const bot = (content: string, checkpoints?: { path: string; previous: string | null }[]): ChatMessage =>
  ({ role: "assistant", content, ...(checkpoints ? { checkpoints } : {}) });

describe("planRewind — konuşma kırpma", () => {
  it("hedef mesaj DAHİL korunur, sonrası atılır", () => {
    const msgs = [user("a"), bot("b"), user("c"), bot("d")];
    const p = planRewind(msgs, 1);
    expect(p.keepCount).toBe(2);
    expect(p.droppedMessages).toBe(2);
  });

  it("son mesaja geri sarmak hiçbir şey atmaz", () => {
    const msgs = [user("a"), bot("b")];
    const p = planRewind(msgs, 1);
    expect(p.droppedMessages).toBe(0);
    expect(planTouchesFiles(p)).toBe(false);
  });

  it("sınır dışı indeks güvenli (dizi uzunluğunu aşmaz)", () => {
    const msgs = [user("a"), bot("b")];
    expect(planRewind(msgs, 99).keepCount).toBe(2);
    expect(planRewind(msgs, -5).keepCount).toBe(0);
  });
});

describe("planRewind — dosya geri yükleme", () => {
  it("tek turda değişen dosyayı eski içeriğiyle geri yükler", () => {
    const msgs = [user("a"), bot("b", [{ path: "x.ts", previous: "ESKI" }])];
    const p = planRewind(msgs, 0);
    expect(p.restore).toEqual([{ path: "x.ts", content: "ESKI" }]);
    expect(p.remove).toEqual([]);
  });

  it("o aralıkta OLUŞTURULAN dosyayı siler (previous === null)", () => {
    const msgs = [user("a"), bot("b", [{ path: "yeni.ts", previous: null }])];
    const p = planRewind(msgs, 0);
    expect(p.remove).toEqual(["yeni.ts"]);
    expect(p.restore).toEqual([]);
  });

  it("AYNI dosya birden çok turda değiştiyse EN ESKİ hâli geri yükler", () => {
    /* Asıl incelik: 3. turdan öncesine dönüyoruz. 5. turun `previous`'ı
       "V2"dir ama o bir ARA durumdur — onu yazmak dosyayı hiç var olmamış
       bir hâlde bırakırdı. Doğru cevap 3. turun `previous`'ı: "V1". */
    const msgs = [
      user("1"),
      bot("tur3", [{ path: "x.ts", previous: "V1" }]),
      user("2"),
      bot("tur5", [{ path: "x.ts", previous: "V2" }]),
      user("3"),
      bot("tur7", [{ path: "x.ts", previous: "V3" }]),
    ];
    const p = planRewind(msgs, 0);
    expect(p.restore).toEqual([{ path: "x.ts", content: "V1" }]);
  });

  it("önce oluşturulup sonra değiştirilen dosya SİLİNİR (oluşturma kazanır)", () => {
    const msgs = [
      user("1"),
      bot("olustur", [{ path: "y.ts", previous: null }]),
      user("2"),
      bot("duzenle", [{ path: "y.ts", previous: "ilk-icerik" }]),
    ];
    const p = planRewind(msgs, 0);
    expect(p.remove).toEqual(["y.ts"]);
    expect(p.restore).toEqual([]);
  });

  it("birden çok dosyayı birlikte planlar ve sıralı döndürür", () => {
    const msgs = [
      user("1"),
      bot("t", [
        { path: "b.ts", previous: "B" },
        { path: "a.ts", previous: "A" },
        { path: "z-yeni.ts", previous: null },
      ]),
    ];
    const p = planRewind(msgs, 0);
    expect(p.restore).toEqual([
      { path: "a.ts", content: "A" },
      { path: "b.ts", content: "B" },
    ]);
    expect(p.remove).toEqual(["z-yeni.ts"]);
  });

  it("kapsam DIŞINDAKİ turların checkpoint'lerine dokunmaz", () => {
    const msgs = [
      user("1"),
      bot("korunan", [{ path: "korunan.ts", previous: "K" }]),
      user("2"),
      bot("atilan", [{ path: "atilan.ts", previous: "A" }]),
    ];
    const p = planRewind(msgs, 1);
    expect(p.restore).toEqual([{ path: "atilan.ts", content: "A" }]);
  });

  it("checkpoint'i olmayan mesajlar sorun çıkarmaz", () => {
    const msgs = [user("a"), bot("b"), user("c"), bot("d")];
    const p = planRewind(msgs, 0);
    expect(planTouchesFiles(p)).toBe(false);
    expect(p.droppedMessages).toBe(3);
  });
});
