import { describe, expect, it } from "vitest";
import { parseCitations } from "../citations";

describe("parseCitations", () => {
  it("boş metin için boş dizi döner", () => {
    expect(parseCitations("", 3)).toEqual([]);
  });

  it("maxIndex 0 iken tüm metni düz metin olarak döner", () => {
    expect(parseCitations("Bir iddia [1].", 0)).toEqual([{ type: "text", value: "Bir iddia [1]." }]);
  });

  it("geçerli tek bir atıfı ayırır", () => {
    expect(parseCitations("Dünya yuvarlaktır [1].", 2)).toEqual([
      { type: "text", value: "Dünya yuvarlaktır " },
      { type: "citation", index: 1 },
      { type: "text", value: "." },
    ]);
  });

  it("birden çok atıfı sırayla ayırır", () => {
    expect(parseCitations("A [1] ve B [2] doğrudur.", 2)).toEqual([
      { type: "text", value: "A " },
      { type: "citation", index: 1 },
      { type: "text", value: " ve B " },
      { type: "citation", index: 2 },
      { type: "text", value: " doğrudur." },
    ]);
  });

  it("maxIndex dışındaki sayıyı düz metin bırakır", () => {
    expect(parseCitations("Bkz. [42] ve [1].", 1)).toEqual([
      { type: "text", value: "Bkz. [42] ve " },
      { type: "citation", index: 1 },
      { type: "text", value: "." },
    ]);
  });

  it("0 veya negatif sayıyı düz metin bırakır", () => {
    expect(parseCitations("[0] geçersiz.", 3)).toEqual([{ type: "text", value: "[0] geçersiz." }]);
  });

  it("atıf metnin başında/sonunda olsa da doğru ayrılır", () => {
    expect(parseCitations("[1] baştaki, sondaki [2]", 2)).toEqual([
      { type: "citation", index: 1 },
      { type: "text", value: " baştaki, sondaki " },
      { type: "citation", index: 2 },
    ]);
  });

  it("art arda iki atıfı ayrı parçalar olarak döner", () => {
    expect(parseCitations("[1][2]", 2)).toEqual([
      { type: "citation", index: 1 },
      { type: "citation", index: 2 },
    ]);
  });
});
