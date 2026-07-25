import { describe, expect, it } from "vitest";
import { chatToMarkdown, formatStamp } from "../chatExport";
import type { Chat, ChatMessage } from "../types";

/* O1 — sohbet dışa aktarma biçimi. Eski çıktı yalnız "**Kullanıcı:** + ham
   metin"di; atıflar düşüyor, gizli köprü mesajları kullanıcıya atfediliyordu. */

const T0 = new Date(2026, 6, 24, 9, 5).getTime();   // 24.07.2026 09:05
const NOW = new Date(2026, 6, 24, 14, 30).getTime(); // 24.07.2026 14:30

function chat(messages: ChatMessage[], extra: Partial<Chat> = {}): Chat {
  return { id: "c1", title: "Test Sohbeti", created_at: T0, messages, ...extra };
}

describe("formatStamp", () => {
  it("saat dilimine/ICU'ya bağlı olmadan DD.MM.YYYY HH:mm üretir", () => {
    expect(formatStamp(T0)).toBe("24.07.2026 09:05");
  });
});

describe("chatToMarkdown — başlık ve meta", () => {
  it("başlığı ve oluşturma/dışa aktarma tarihlerini yazar", () => {
    const md = chatToMarkdown(chat([{ role: "user", content: "selam" }]), { now: NOW });
    expect(md).toContain("# Test Sohbeti");
    expect(md).toContain("**Oluşturma:** 24.07.2026 09:05");
    expect(md).toContain("**Dışa aktarma:** 24.07.2026 14:30");
  });

  it("etiket ve token bilgisi VARSA yazar", () => {
    const md = chatToMarkdown(
      chat([{ role: "user", content: "selam" }], { tags: ["rapor", "analiz"], totalInTokens: 1240, totalOutTokens: 3150 }),
      { now: NOW },
    );
    expect(md).toContain("**Etiketler:** rapor, analiz");
    expect(md).toMatch(/\*\*Token:\*\* .*girdi · .*çıktı/);
  });

  it("etiket/token yoksa o satırları hiç eklemez (boş alan gürültüsü olmasın)", () => {
    const md = chatToMarkdown(chat([{ role: "user", content: "selam" }]), { now: NOW });
    expect(md).not.toContain("**Etiketler:**");
    expect(md).not.toContain("**Token:**");
  });

  it("başlıksız sohbete makul bir ad verir", () => {
    const md = chatToMarkdown(chat([{ role: "user", content: "x" }], { title: "" }), { now: NOW });
    expect(md).toContain("# Sohbet");
  });
});

describe("chatToMarkdown — turlar", () => {
  it("kullanıcı ve asistan turlarını ayrı başlıklarla yazar", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "merhaba" },
      { role: "assistant", content: "Merhaba!" },
    ]), { now: NOW });
    expect(md).toContain("## Kullanıcı\n\nmerhaba");
    expect(md).toContain("## Asistan\n\nMerhaba!");
  });

  it("boş içerikli mesajları atlar (akışta kalan boş balon)", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "soru" },
      { role: "assistant", content: "   " },
    ]), { now: NOW });
    expect(md.match(/## Asistan/g)).toBeNull();
  });

  it("meta'daki mesaj sayısı köprü mesajlarını saymaz", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "soru" },
      { role: "assistant", content: "cevap" },
      { role: "user", content: "**Kod çıktısı** (python):\n```\n4\n```" },
    ]), { now: NOW });
    expect(md).toContain("**Mesaj:** 2");
  });
});

describe("chatToMarkdown — atıflar (önceden tamamen kayboluyordu)", () => {
  it("kaynakları numaralı bağlantı listesi olarak ekler", () => {
    const md = chatToMarkdown(chat([
      { role: "assistant", content: "Cevap", sources: [
        { title: "Kaynak A", url: "https://a.example" },
        { title: "Kaynak B", url: "https://b.example" },
      ] },
    ]), { now: NOW });
    expect(md).toContain("**Kaynaklar**");
    expect(md).toContain("1. [Kaynak A](https://a.example)");
    expect(md).toContain("2. [Kaynak B](https://b.example)");
  });

  it("başlığı olmayan kaynakta URL'i etiket olarak kullanır", () => {
    const md = chatToMarkdown(chat([
      { role: "assistant", content: "C", sources: [{ title: "", url: "https://x.example" }] },
    ]), { now: NOW });
    expect(md).toContain("1. [https://x.example](https://x.example)");
  });

  it("kaynak yoksa Kaynaklar bölümü eklenmez", () => {
    const md = chatToMarkdown(chat([{ role: "assistant", content: "C" }]), { now: NOW });
    expect(md).not.toContain("**Kaynaklar**");
  });
});

describe("chatToMarkdown — gizli köprü mesajları doğru atfedilir", () => {
  it("Kod çıktısı mesajı 'Kullanıcı' turu olarak DEĞİL, araç çıktısı olarak yazılır", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "2+2 kaç?" },
      { role: "user", content: "**Kod çıktısı** (python):\n```\n4\n```" },
    ]), { now: NOW });
    expect(md).toContain("### Araç çıktısı");
    /* Kullanıcının yazdığı tek gerçek mesaj var → tek "## Kullanıcı" başlığı. */
    expect(md.match(/## Kullanıcı/g)).toHaveLength(1);
  });

  it("Terminal çıktısı mesajı da aynı şekilde etiketlenir", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "**Terminal çıktısı** (`ls`):\n```\na.ts\n```" },
    ]), { now: NOW });
    expect(md).toContain("### Araç çıktısı");
    expect(md.match(/## Kullanıcı/g)).toBeNull();
  });
});

describe("chatToMarkdown — ajan ve Fusion rozetleri", () => {
  it("ajan etiketi çözülebiliyorsa asistan başlığına eklenir", () => {
    const md = chatToMarkdown(chat([{ role: "assistant", content: "C", agentId: "explain" }]), {
      now: NOW,
      agentLabel: (id) => (id === "explain" ? "Açıkla" : undefined),
    });
    expect(md).toContain("## Asistan · Açıkla");
  });

  it("Fusion modelleri kayıtlıysa yazılır", () => {
    const md = chatToMarkdown(chat([{ role: "assistant", content: "C", fusionModels: ["m1", "m2"] }]), { now: NOW });
    expect(md).toContain("## Asistan · Fusion: m1, m2");
  });

  it("hiçbiri yoksa sade 'Asistan' başlığı kalır", () => {
    const md = chatToMarkdown(chat([{ role: "assistant", content: "C" }]), { now: NOW });
    expect(md).toContain("## Asistan\n");
    expect(md).not.toContain("## Asistan ·");
  });
});

describe("chatToMarkdown — genel biçim", () => {
  it("boş sohbette bile geçerli markdown üretir", () => {
    const md = chatToMarkdown(chat([]), { now: NOW });
    expect(md).toContain("# Test Sohbeti");
    expect(md).toContain("**Mesaj:** 0");
  });

  it("üç ve fazlası ardışık boş satır bırakmaz, tek satır sonuyla biter", () => {
    const md = chatToMarkdown(chat([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]), { now: NOW });
    expect(md).not.toMatch(/\n{3,}/);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });
});
