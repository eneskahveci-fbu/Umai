import { describe, expect, it } from "vitest";

/* Bu testler DOM'suz (vitest environment: "node") çalıştığı için hook'un
   kendisini render etmez; ölçüm mantığının SAF çekirdeğini doğrular. Hook
   içindeki hesap birebir budur (bkz. useSlidingIndicator.measure): göstergenin
   konumu, aktif sekmenin track'e GÖRE konumu + track'in kendi kaydırması. */

function indicatorBox(
  track: { left: number; top: number; scrollLeft: number; scrollTop: number },
  el: { left: number; top: number; width: number; height: number },
  axis: "x" | "y",
): { start: number; size: number } {
  return axis === "x"
    ? { start: el.left - track.left + track.scrollLeft, size: el.width }
    : { start: el.top - track.top + track.scrollTop, size: el.height };
}

describe("kayan gösterge konumu", () => {
  const track = { left: 100, top: 50, scrollLeft: 0, scrollTop: 0 };

  it("yatay eksende sekmenin track'e göre solunu ve genişliğini verir", () => {
    const el = { left: 180, top: 50, width: 64, height: 32 };
    expect(indicatorBox(track, el, "x")).toEqual({ start: 80, size: 64 });
  });

  it("dikey eksende üstünü ve yüksekliğini verir", () => {
    const el = { left: 100, top: 138, width: 200, height: 40 };
    expect(indicatorBox(track, el, "y")).toEqual({ start: 88, size: 40 });
  });

  it("track kaydırılmışsa kaydırma miktarı EKLENİR (aksi halde gösterge kayar)", () => {
    /* Kaydırılabilir bir şeritte getBoundingClientRect zaten kaydırılmış
       konumu verir; göstergenin konumu ise track'in İÇ koordinat sisteminde
       olduğundan scrollLeft/scrollTop geri eklenmelidir. */
    const scrolled = { ...track, scrollLeft: 120, scrollTop: 200 };
    const el = { left: 140, top: 60, width: 50, height: 30 };
    expect(indicatorBox(scrolled, el, "x").start).toBe(140 - 100 + 120);
    expect(indicatorBox(scrolled, el, "y").start).toBe(60 - 50 + 200);
  });
});
