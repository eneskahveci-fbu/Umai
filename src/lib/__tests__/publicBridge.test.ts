import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Site köprüyü ve Laya kurulumunu herkese açık sunar (public/…): SSH/repo klonu
   olmadan uygulama terminalinden `curl -fsSL <site>/setup-laya.sh | bash`.
   Kopyalar kaynaklarından sapmasın — eskiden public/bridge.mjs geride kalmıştı. */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("public köprü dosyaları kaynakla birebir", () => {
  it("public/bridge.mjs === scripts/terminal-bridge/bridge.mjs", () => {
    expect(read("public/bridge.mjs")).toBe(read("scripts/terminal-bridge/bridge.mjs"));
  });
  it("public/setup-laya.sh === deploy/oracle/setup-laya.sh", () => {
    expect(read("public/setup-laya.sh")).toBe(read("deploy/oracle/setup-laya.sh"));
  });
});
