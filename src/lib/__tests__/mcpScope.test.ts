import { describe, expect, it } from "vitest";
import { filterMcpServersForModel } from "../mcpScope";
import type { McpServer } from "../types";

function srv(patch: Partial<McpServer>): McpServer {
  return { id: "s1", name: "Test", url: "https://x.test", enabled: true, ...patch };
}

describe("filterMcpServersForModel", () => {
  it("allowedModelIds yoksa tüm modellere açık", () => {
    const servers = [srv({ id: "a" })];
    expect(filterMcpServersForModel(servers, "model-1")).toHaveLength(1);
    expect(filterMcpServersForModel(servers, "model-2")).toHaveLength(1);
  });

  it("allowedModelIds boş dizi ise tüm modellere açık", () => {
    const servers = [srv({ id: "a", allowedModelIds: [] })];
    expect(filterMcpServersForModel(servers, "model-1")).toHaveLength(1);
  });

  it("allowedModelIds doluysa yalnız listelenen modeller görür", () => {
    const servers = [srv({ id: "a", allowedModelIds: ["model-1"] })];
    expect(filterMcpServersForModel(servers, "model-1")).toHaveLength(1);
    expect(filterMcpServersForModel(servers, "model-2")).toHaveLength(0);
  });

  it("enabled:false olan sunucu modelden bağımsız hariç tutulur", () => {
    const servers = [srv({ id: "a", enabled: false })];
    expect(filterMcpServersForModel(servers, "model-1")).toHaveLength(0);
  });

  it("karma liste doğru filtrelenir", () => {
    const servers = [
      srv({ id: "all", allowedModelIds: undefined }),
      srv({ id: "restricted", allowedModelIds: ["model-2"] }),
      srv({ id: "off", enabled: false }),
    ];
    const result = filterMcpServersForModel(servers, "model-1");
    expect(result.map((s) => s.id)).toEqual(["all"]);
  });
});
