import { describe, expect, it } from "vitest";
import { extractStylePreferences, buildPersonalityLayer } from "../styleMemory";
import type { ChatMessage } from "../types";

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("extractStylePreferences", () => {
  it("kullanıcı onayladığı kod stilini tercih olarak çıkarır", () => {
    const messages: ChatMessage[] = [
      msg("user", "bir toplama fonksiyonu yaz"),
      msg("assistant", "```ts\nconst add = (a: number, b: number) => a + b;\n```"),
      msg("user", "harika, tam istediğim gibi"),
    ];
    const prefs = extractStylePreferences(messages);
    expect(prefs).toContain("arrow function tercih eder");
  });

  it("kullanıcı düzelttiğinde önceki stili tercih SAYMAZ", () => {
    const messages: ChatMessage[] = [
      msg("user", "bir fonksiyon yaz"),
      msg("assistant", "```ts\nfunction add(a, b) { return a + b; }\n```"),
      msg("user", "hayır, böyle olmaz, arrow function kullan"),
    ];
    const prefs = extractStylePreferences(messages);
    expect(prefs).not.toContain("arrow function tercih eder");
  });

  it("açık tercih kelimelerini (TypeScript, Tailwind, camelCase) yakalar", () => {
    const messages: ChatMessage[] = [
      msg("user", "TypeScript ve Tailwind CSS ile camelCase kullanarak yaz"),
      msg("assistant", "tamam"),
    ];
    const prefs = extractStylePreferences(messages);
    expect(prefs).toContain("TypeScript tercih eder");
    expect(prefs).toContain("Tailwind CSS kullanır");
    expect(prefs).toContain("camelCase kullanır");
  });

  it("boş/tek mesajlı geçmişte boş dizi döner", () => {
    expect(extractStylePreferences([])).toEqual([]);
    expect(extractStylePreferences([msg("user", "merhaba")])).toEqual([]);
  });

  it("onay yoksa (son kullanıcı mesajı nötrse) kod stilini tercih saymaz", () => {
    const messages: ChatMessage[] = [
      msg("user", "bir fonksiyon yaz"),
      msg("assistant", "```ts\nconst add = (a, b) => a + b;\n```"),
      msg("user", "peki bir de çıkarma fonksiyonu yaz"),
    ];
    const prefs = extractStylePreferences(messages);
    expect(prefs).not.toContain("arrow function tercih eder");
  });
});

describe("buildPersonalityLayer", () => {
  it("boş listede boş string döner", () => {
    expect(buildPersonalityLayer([])).toBe("");
  });

  it("tercihleri madde işaretli bir katman olarak biçimlendirir", () => {
    const out = buildPersonalityLayer(["TypeScript tercih eder", "2 boşluk girintisi"]);
    expect(out).toContain("TypeScript tercih eder");
    expect(out).toContain("2 boşluk girintisi");
    expect(out).toContain("•");
  });
});
