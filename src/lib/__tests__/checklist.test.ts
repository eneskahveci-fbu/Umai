import { describe, expect, it } from "vitest";
import { toggleChecklistLine } from "../checklist";

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
});
