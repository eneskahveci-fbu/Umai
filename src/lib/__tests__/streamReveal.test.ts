import { describe, expect, it, vi } from "vitest";
import {
  revealStep, createReveal,
  MIN_CHARS_PER_FRAME, CATCH_UP_DIVISOR, MAX_PENDING_BEFORE_JUMP,
} from "../streamReveal";

/* R2/S1 — akış her token'da tüm mesajı yeniden çizdiriyordu (uzun yanıtta
   ~1.000 markdown ayrıştırması) ve metin blok blok zıplayarak beliriyordu. */

describe("revealStep", () => {
  it("kalan yazının bir bölümünü açar", () => {
    expect(revealStep(0, 600)).toBe(Math.ceil(600 / CATCH_UP_DIVISOR));
  });

  it("çok az kalmışsa bile ilerler (takılıp kalmaz)", () => {
    expect(revealStep(99, 100)).toBe(100);
    expect(revealStep(0, 1)).toBe(1);
    expect(revealStep(0, MIN_CHARS_PER_FRAME)).toBe(MIN_CHARS_PER_FRAME);
  });

  it("hedefi asla aşmaz", () => {
    expect(revealStep(10, 12)).toBe(12);
    expect(revealStep(50, 50)).toBe(50);
  });

  it("hedef geriye giderse (yeni tur) hedefe oturur", () => {
    expect(revealStep(500, 3)).toBe(3);
  });

  it("çok geride kalındıysa animasyonu bırakıp sona atlar", () => {
    const far = MAX_PENDING_BEFORE_JUMP + 1000;
    expect(revealStep(0, far)).toBe(far);
  });

  it("sonlu sayıda adımda hedefe ulaşır", () => {
    let shown = 0;
    let steps = 0;
    while (shown < 2000 && steps < 1000) { shown = revealStep(shown, 2000); steps++; }
    expect(shown).toBe(2000);
    expect(steps).toBeLessThan(100);
  });
});

/** Elle sürülen sahte rAF — kareleri test içinde ilerletmek için. */
function fakeRaf() {
  const queue: (() => void)[] = [];
  return {
    raf: (cb: () => void) => { queue.push(cb); return queue.length; },
    cancelRaf: () => { queue.length = 0; },
    /** TEK bir kare çalıştırır. */
    step() { queue.shift()?.(); },
    /** Bekleyen tüm kareleri sırayla çalıştırır (yeni eklenenler dahil). */
    flush(max = 200) {
      let n = 0;
      while (queue.length && n < max) { queue.shift()!(); n++; }
      return n;
    },
    pending: () => queue.length,
  };
}

describe("createReveal", () => {
  it("token başına DEĞİL, kare başına çizer", () => {
    const f = fakeRaf();
    const onFrame = vi.fn();
    const r = createReveal(onFrame, f);

    /* Tek bir karenin içinde 5 token geldi (eski kodda 5 yeniden çizim). */
    let full = "";
    for (const tok of ["Mer", "haba", " dün", "ya", "!"]) { full += tok; r.push(full); }
    expect(onFrame).not.toHaveBeenCalled();   // hiçbir push doğrudan çizmez

    f.step();                                  // yalnız BİR kare
    expect(onFrame).toHaveBeenCalledTimes(1);  // 5 token → 1 çizim
  });

  it("metni baştan sona, kesintisiz büyüyerek açar", () => {
    const f = fakeRaf();
    const seen: string[] = [];
    const r = createReveal((t) => seen.push(t), f);
    const full = "a".repeat(300);
    r.push(full);
    f.flush();

    expect(seen[seen.length - 1]).toBe(full);
    /* Her kare bir öncekinin devamı olmalı — geri sarma/atlama yok. */
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].startsWith(seen[i - 1])).toBe(true);
      expect(seen[i].length).toBeGreaterThan(seen[i - 1].length);
    }
  });

  it("aynı içerikle gereksiz çizim yapmaz", () => {
    const f = fakeRaf();
    const onFrame = vi.fn();
    const r = createReveal(onFrame, f);
    r.push("abc");
    f.flush();
    const after = onFrame.mock.calls.length;
    r.push("abc");           // değişiklik yok
    f.flush();
    expect(onFrame.mock.calls.length).toBe(after);
  });

  it("finish() kalanı tek seferde yazar ve döngüyü durdurur", () => {
    const f = fakeRaf();
    const onFrame = vi.fn();
    const r = createReveal(onFrame, f);
    const full = "x".repeat(5000);
    r.push(full);
    r.finish();

    expect(onFrame).toHaveBeenLastCalledWith(full);
    const calls = onFrame.mock.calls.length;
    f.flush();
    expect(onFrame.mock.calls.length).toBe(calls);   // artık kare işlemez
  });

  it("finish() zaten tamamlanmışsa tekrar yazmaz", () => {
    const f = fakeRaf();
    const onFrame = vi.fn();
    const r = createReveal(onFrame, f);
    r.push("kısa");
    f.flush();
    const calls = onFrame.mock.calls.length;
    r.finish();
    expect(onFrame.mock.calls.length).toBe(calls);
  });

  it("cancel() sonrası hiçbir çizim yapılmaz (abort/unmount)", () => {
    const f = fakeRaf();
    const onFrame = vi.fn();
    const r = createReveal(onFrame, f);
    r.push("uzun bir metin".repeat(50));
    r.cancel();
    f.flush();
    r.push("daha da uzun");
    f.flush();
    expect(onFrame).not.toHaveBeenCalled();
  });

  it("rAF yoksa animasyonsuz doğrudan yazar (SSR/eski tarayıcı — kırılmaz)", () => {
    const onFrame = vi.fn();
    const r = createReveal(onFrame, { raf: undefined, cancelRaf: undefined });
    r.push("merhaba");
    expect(onFrame).toHaveBeenCalledWith("merhaba");
    r.finish();
  });
});
