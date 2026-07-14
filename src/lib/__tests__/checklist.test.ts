import { describe, expect, it } from "vitest";
import { extractCheckedItems, toggleChecklistLine } from "../checklist";

describe("toggleChecklistLine", () => {
  it("işaretsiz bir kutuyu işaretler", () => {
    const content = "Yapılacaklar:\n- [ ] süt al\n- [ ] ekmek al";
    expect(toggleChecklistLine(content, 2)).toBe("Yapılacaklar:\n- [x] süt al\n- [ ] ekmek al");
  });

  it("belgedeki üçüncü satırdaki (ikinci checkbox) kutuyu doğru bulur", () => {
    const content = "Yapılacaklar:\n- [ ] süt al\n- [ ] ekmek al";
    expect(toggleChecklistLine(content, 3)).toBe("Yapılacaklar:\n- [ ] süt al\n- [x] ekmek al");
  });

  it("işaretli bir kutunun işaretini kaldırır", () => {
    const content = "- [x] tamamlandı";
    expect(toggleChecklistLine(content, 1)).toBe("- [ ] tamamlandı");
  });

  it("büyük X'i de işaretli sayar", () => {
    const content = "- [X] tamamlandı";
    expect(toggleChecklistLine(content, 1)).toBe("- [ ] tamamlandı");
  });

  it("* işaretleyicisiyle de çalışır", () => {
    const content = "* [ ] görev";
    expect(toggleChecklistLine(content, 1)).toBe("* [x] görev");
  });

  it("işaretleme kutusu olmayan bir satırı değiştirmeden bırakır", () => {
    const content = "Bu normal bir paragraf.";
    expect(toggleChecklistLine(content, 1)).toBe(content);
  });

  it("aralık dışı satır numarasında değiştirmeden döner", () => {
    const content = "- [ ] tek satır";
    expect(toggleChecklistLine(content, 5)).toBe(content);
    expect(toggleChecklistLine(content, 0)).toBe(content);
  });

  it("girintili alt-madde kutularında çalışır", () => {
    const content = "- [ ] üst\n  - [ ] alt madde";
    expect(toggleChecklistLine(content, 2)).toBe("- [ ] üst\n  - [x] alt madde");
  });

  it("numaralı liste işaretçisiyle (1.) çalışır — AI'nın canlıda ürettiği asıl bug", () => {
    const content = "1. [ ] Tek dil / Fiyat (USD)\n2. [ ] Çokdilli (İNG, TR) + Döviz API";
    expect(toggleChecklistLine(content, 1)).toBe("1. [x] Tek dil / Fiyat (USD)\n2. [ ] Çokdilli (İNG, TR) + Döviz API");
    expect(toggleChecklistLine(content, 2)).toBe("1. [ ] Tek dil / Fiyat (USD)\n2. [x] Çokdilli (İNG, TR) + Döviz API");
  });

  it("numaralı liste işaretçisiyle (1)) parantez varyantında da çalışır", () => {
    const content = "1) [ ] seçenek";
    expect(toggleChecklistLine(content, 1)).toBe("1) [x] seçenek");
  });

  it("girintili numaralı alt-liste checkbox'ında çalışır (iç içe liste)", () => {
    const content = "1. **Çoklu dil / Para birimi**\n   1. [ ] Tek dil / Fiyat (USD)\n   2. [ ] Çokdilli (İNG, TR) + Döviz API";
    expect(toggleChecklistLine(content, 2)).toBe(
      "1. **Çoklu dil / Para birimi**\n   1. [x] Tek dil / Fiyat (USD)\n   2. [ ] Çokdilli (İNG, TR) + Döviz API",
    );
  });

  it("çift haneli numaralarla da çalışır", () => {
    const content = "10. [ ] onuncu madde";
    expect(toggleChecklistLine(content, 1)).toBe("10. [x] onuncu madde");
  });
});

describe("extractCheckedItems", () => {
  it("yalnızca işaretli satırların metnini döner", () => {
    const content = "- [x] süt al\n- [ ] ekmek al\n- [X] yumurta al";
    expect(extractCheckedItems(content)).toEqual(["süt al", "yumurta al"]);
  });

  it("numaralı liste işaretçilerinde de çalışır", () => {
    const content = "1. [x] Tek dil / Fiyat (USD)\n2. [ ] Çokdilli (İNG, TR) + Döviz API";
    expect(extractCheckedItems(content)).toEqual(["Tek dil / Fiyat (USD)"]);
  });

  it("işaretli satır yoksa boş dizi döner", () => {
    expect(extractCheckedItems("- [ ] madde\nBu normal bir paragraf.")).toEqual([]);
  });
});
