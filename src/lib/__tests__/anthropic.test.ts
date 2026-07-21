import { describe, expect, it } from "vitest";
import { convertMessages } from "../anthropic";

describe("convertMessages — system bloğu önbellek bölünmesi", () => {
  it("tek system mesajı varsa o TEK blok önbelleklenir (eski davranış korunur)", () => {
    const { system } = convertMessages([
      { role: "system", content: "sabit sistem promptu" },
      { role: "user", content: "merhaba" },
    ]);
    expect(system).toHaveLength(1);
    expect(system[0]).toMatchObject({ type: "text", text: "sabit sistem promptu", cache_control: { type: "ephemeral" } });
  });

  it("iki system mesajı varsa yalnız SONUNCUSU önbelleksiz kalır", () => {
    const { system } = convertMessages([
      { role: "system", content: "repo haritası + araç talimatları (sabit)" },
      { role: "system", content: "web arama sonuçları (değişken)" },
      { role: "user", content: "merhaba" },
    ]);
    expect(system).toHaveLength(2);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text).toBe("repo haritası + araç talimatları (sabit)");
    expect(system[1].cache_control).toBeUndefined();
    expect(system[1].text).toBe("web arama sonuçları (değişken)");
  });

  it("system mesajı yoksa boş dizi döner", () => {
    const { system } = convertMessages([{ role: "user", content: "merhaba" }]);
    expect(system).toHaveLength(0);
  });

  it("boş/whitespace system içeriği atlanır", () => {
    const { system } = convertMessages([
      { role: "system", content: "  " },
      { role: "system", content: "gerçek içerik" },
      { role: "user", content: "merhaba" },
    ]);
    expect(system).toHaveLength(1);
    expect(system[0].text).toBe("gerçek içerik");
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("user/assistant/tool mesajları doğru dönüştürülür", () => {
    const { messages } = convertMessages([
      { role: "system", content: "sys" },
      { role: "user", content: "soru" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call_1", function: { name: "list_files", arguments: '{"filter":"src"}' } }],
      },
      { role: "tool", content: "a.ts\nb.ts", tool_call_id: "call_1" },
    ]);
    expect(messages[0]).toEqual({ role: "user", content: [{ type: "text", text: "soru" }] });
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content[0]).toMatchObject({ type: "tool_use", id: "call_1", name: "list_files", input: { filter: "src" } });
    /* tool sonucu ayrı bir "user" mesajına gider (Claude'un beklediği format);
       ardışık aynı-rol mesajları birleştirilir, bu yüzden ayrı bir 3. eleman olur. */
    expect(messages[2]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "a.ts\nb.ts" }] });
  });
});
