import { describe, expect, it } from "vitest";
import { deriveJobTitle, nextRunnableJob, jobCounts, withStep, latestHeading, type BackgroundJob } from "../jobs";

function job(over: Partial<BackgroundJob>): BackgroundJob {
  return { id: "1", goal: "g", title: "t", status: "queued", steps: [], createdAt: 0, updatedAt: 0, ...over };
}

describe("deriveJobTitle", () => {
  it("ilk satırı alır, boşlukları toplar", () => {
    expect(deriveJobTitle("  Rapor  yaz\nikinci satır")).toBe("Rapor yaz");
  });
  it("60 karakterden uzunu kırpar", () => {
    const t = deriveJobTitle("x".repeat(80));
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith("…")).toBe(true);
  });
  it("boş hedefte 'Görev'", () => {
    expect(deriveJobTitle("   ")).toBe("Görev");
  });
});

describe("nextRunnableJob", () => {
  it("çalışan iş varsa yeni başlatmaz", () => {
    expect(nextRunnableJob([job({ id: "a", status: "running" }), job({ id: "b", status: "queued" })])).toBe(null);
  });
  it("çalışan yoksa ilk queued'i döndürür", () => {
    const r = nextRunnableJob([job({ id: "a", status: "done" }), job({ id: "b", status: "queued" }), job({ id: "c", status: "queued" })]);
    expect(r?.id).toBe("b");
  });
  it("queued yoksa null", () => {
    expect(nextRunnableJob([job({ id: "a", status: "done" })])).toBe(null);
  });
});

describe("jobCounts", () => {
  it("durumları sayar, active = queued + running", () => {
    const c = jobCounts([job({ status: "queued" }), job({ status: "running" }), job({ status: "done" }), job({ status: "error" })]);
    expect(c).toEqual({ queued: 1, running: 1, done: 1, error: 1, active: 2, total: 4 });
  });
});

describe("withStep", () => {
  it("adım ekler ve updatedAt günceller", () => {
    const j = withStep(job({}), "Plan yazılıyor", 5);
    expect(j.steps).toEqual([{ text: "Plan yazılıyor", at: 5 }]);
    expect(j.updatedAt).toBe(5);
  });
  it("aynı metni art arda eklemez", () => {
    let j = withStep(job({}), "aynı", 1);
    j = withStep(j, "aynı", 2);
    expect(j.steps.length).toBe(1);
  });
  it("boş metni yok sayar", () => {
    expect(withStep(job({}), "   ", 1).steps.length).toBe(0);
  });
  it("son 30 adımı tutar", () => {
    let j = job({});
    for (let i = 0; i < 40; i++) j = withStep(j, `adım ${i}`, i);
    expect(j.steps.length).toBe(30);
    expect(j.steps[0].text).toBe("adım 10");
  });
});

describe("latestHeading", () => {
  it("son markdown başlığını çıkarır", () => {
    expect(latestHeading("## Plan\n- a\n## Sonuç\nmetin")).toBe("Sonuç");
  });
  it("başlık yoksa null", () => {
    expect(latestHeading("düz metin")).toBe(null);
  });
});
