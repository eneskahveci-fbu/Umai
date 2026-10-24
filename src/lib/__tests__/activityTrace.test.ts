import { describe, expect, it } from "vitest";
import {
  buildTrace,
  entryDuration,
  filterTrace,
  formatDuration,
  prettyJson,
  summarizeArgs,
  traceStats,
} from "../activityTrace";
import type { ChatMessage } from "../types";

const messages: ChatMessage[] = [
  { role: "user", content: "şu hatayı düzelt" },
  {
    role: "assistant",
    content: "bakıyorum",
    toolCalls: [
      {
        id: "a",
        name: "read_file",
        arguments: '{"path":"src/app/page.tsx"}',
        status: "done",
        startedAt: 1_000,
        endedAt: 1_450,
        result: "içerik",
      },
      {
        id: "b",
        name: "write_file",
        arguments: '{"path":"src/lib/x.ts","content":"y"}',
        status: "error",
        startedAt: 2_000,
        endedAt: 2_800,
        result: "izin yok",
      },
    ],
    commands: [
      { command: "npm test", status: "done", output: "3 passed" },
    ],
    checkpoints: [
      { path: "src/lib/x.ts", previous: null },
      { path: "src/app/page.tsx", previous: "eski" },
    ],
  },
  { role: "assistant", content: "boş tur" },
];

describe("summarizeArgs", () => {
  it("yol, komut ve sorguyu bulur", () => {
    expect(summarizeArgs('{"path":"a/b.ts"}')).toBe("a/b.ts");
    expect(summarizeArgs('{"command":"ls -la"}')).toBe("ls -la");
    expect(summarizeArgs('{"pattern":"TODO"}')).toBe("TODO");
  });
  it("alt görev dizisini sayar", () => {
    expect(summarizeArgs('{"tasks":[{"title":"a"},{"title":"b"}]}')).toBe("2 alt görev");
  });
  it("bozuk JSON'da ilk satıra düşer", () => {
    expect(summarizeArgs("satır bir\nsatır iki")).toBe("satır bir");
    expect(summarizeArgs(undefined)).toBeUndefined();
  });
});

describe("prettyJson", () => {
  it("girintili hale getirir", () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });
  it("JSON olmayanı olduğu gibi bırakır", () => {
    expect(prettyJson("düz metin")).toBe("düz metin");
    expect(prettyJson(undefined)).toBeUndefined();
  });
});

describe("formatDuration", () => {
  it("milisaniye, saniye ve dakika biçimleri", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(1_500)).toBe("1.5s");
    expect(formatDuration(42_000)).toBe("42s");
    expect(formatDuration(125_000)).toBe("2d 5s");
  });
  it("geçersiz değerde tire döner", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});

describe("buildTrace", () => {
  const turns = buildTrace(messages);

  it("yalnızca dolu asistan turlarını alır", () => {
    expect(turns).toHaveLength(1);
    expect(turns[0].number).toBe(1);
  });

  it("araç, komut ve dosya kayıtlarını sırayla çıkarır", () => {
    const entries = turns[0].entries;
    expect(entries.map((e) => e.kind)).toEqual([
      "tool", "tool", "command", "write", "write",
    ]);
    expect(entries[0].label).toBe("read_file");
    expect(entries[0].detail).toBe("src/app/page.tsx");
    expect(entries[1].status).toBe("error");
    expect(entries[2].detail).toBe("npm test");
    expect(entries[3].label).toBe("oluşturuldu");
    expect(entries[4].label).toBe("değiştirildi");
  });

  it("girdi ve çıktıyı genişletilebilir tutar", () => {
    const [read] = turns[0].entries;
    expect(read.input).toContain('"path": "src/app/page.tsx"');
    expect(read.output).toBe("içerik");
  });

  it("boş sohbette boş dizi döner", () => {
    expect(buildTrace([])).toEqual([]);
  });
});

describe("traceStats", () => {
  it("türleri, hatayı ve toplam süreyi sayar", () => {
    const stats = traceStats(buildTrace(messages));
    expect(stats).toMatchObject({
      tools: 2,
      commands: 1,
      writes: 2,
      errors: 1,
      total: 5,
      durationMs: 1_250,
    });
  });
});

describe("entryDuration", () => {
  it("bitmemiş veya ters kayıtlarda undefined döner", () => {
    expect(entryDuration({ id: "1", kind: "tool", label: "x", status: "pending", startedAt: 5 })).toBeUndefined();
    expect(
      entryDuration({ id: "1", kind: "tool", label: "x", status: "done", startedAt: 9, endedAt: 5 }),
    ).toBeUndefined();
  });
});

describe("filterTrace", () => {
  const turns = buildTrace(messages);

  it("türe göre filtreler ve boş turları düşürür", () => {
    const onlyCommands = filterTrace(turns, "command");
    expect(onlyCommands).toHaveLength(1);
    expect(onlyCommands[0].entries).toHaveLength(1);
    expect(filterTrace(turns, "write")[0].entries).toHaveLength(2);
  });

  it("arama yolu, komutu ve çıktıyı kapsar", () => {
    expect(filterTrace(turns, "all", "page.tsx")[0].entries).toHaveLength(2);
    expect(filterTrace(turns, "all", "npm")[0].entries).toHaveLength(1);
    expect(filterTrace(turns, "all", "izin yok")[0].entries).toHaveLength(1);
    expect(filterTrace(turns, "all", "yok-böyle-şey")).toEqual([]);
  });

  it("filtre ve arama yoksa aynı referansı döner", () => {
    expect(filterTrace(turns, "all", "  ")).toBe(turns);
  });
});
