import { describe, expect, it } from "vitest";
import { EXTENSION_PACKS } from "../extensions/registry";
import { ALL_TOOL_CATALOG } from "../constants";

/* Eklenti paketleri (modüler eklenti sistemi) bütünlük + tutarlılık testleri.
   Her paketin sağladığı araçlar gerçek araç kataloğunda bulunmalı; aksi halde
   aç/kapat anahtarı var olmayan bir izni ayarlar (sessiz hata). */
describe("EXTENSION_PACKS", () => {
  it("her paketin id/ad/açıklaması ve en az bir aracı var", () => {
    for (const p of EXTENSION_PACKS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.provides.length).toBeGreaterThan(0);
    }
  });

  it("paket id'leri benzersiz", () => {
    const ids = EXTENSION_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sağlanan tüm araçlar gerçek araç kataloğunda mevcut", () => {
    const known = new Set(ALL_TOOL_CATALOG.map((t) => t.name));
    for (const p of EXTENSION_PACKS) {
      for (const tool of p.provides) {
        expect(known.has(tool), `${p.id} → ${tool} katalogda yok`).toBe(true);
      }
    }
  });
});

/* Aç/kapat mantığı (ExtensionsSettings ile aynı): bir paket, araçlarının HİÇBİRİ
   açıkça reddedilmemişse açıktır; toggle ilgili izinleri toplu ayarlar. */
function isOn(perms: Record<string, boolean>, provides: string[]) {
  return provides.every((n) => perms[n] !== false);
}
function toggle(perms: Record<string, boolean>, provides: string[], on: boolean) {
  const next = { ...perms };
  for (const n of provides) { if (on) delete next[n]; else next[n] = false; }
  return next;
}

describe("eklenti aç/kapat mantığı", () => {
  const provides = ["git_diff", "git_log", "git_blame"];

  it("varsayılan (boş izin) → açık sayılır", () => {
    expect(isOn({}, provides)).toBe(true);
  });

  it("kapatma tüm araçları reddeder, isOn false olur", () => {
    const off = toggle({}, provides, false);
    expect(off.git_diff).toBe(false);
    expect(isOn(off, provides)).toBe(false);
  });

  it("açma reddleri kaldırır, isOn yeniden true", () => {
    const off = toggle({}, provides, false);
    const on = toggle(off, provides, true);
    expect(isOn(on, provides)).toBe(true);
    expect("git_diff" in on).toBe(false);
  });

  it("kısmen reddedilmiş paket kapalı sayılır", () => {
    expect(isOn({ git_log: false }, provides)).toBe(false);
  });
});
