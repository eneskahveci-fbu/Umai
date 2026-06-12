import { describe, expect, it } from "vitest";
import { applyEditBranch, applySwitchBranch } from "../branching";
import type { ChatMessage } from "../types";

const u = (c: string): ChatMessage => ({ role: "user", content: c });
const a = (c: string): ChatMessage => ({ role: "assistant", content: c });

describe("applyEditBranch", () => {
  it("düzenleyince yeni dal açar, eskisini korur, sonrasını keser", () => {
    const msgs = [u("merhaba"), a("yanıt1"), u("devam")];
    const out = applyEditBranch(msgs, 0, "selam");
    expect(out).toHaveLength(1); // sonrası kesildi
    expect(out[0].content).toBe("selam");
    expect(out[0].branches).toHaveLength(2); // eski + yeni
    expect(out[0].branchIndex).toBe(1);
    // eski dal eski içeriği + zinciri saklar
    expect(out[0].branches![0][0].content).toBe("merhaba");
    expect(out[0].branches![0]).toHaveLength(3);
  });

  it("geçersiz index'te değişmez", () => {
    const msgs = [u("x")];
    expect(applyEditBranch(msgs, 5, "y")).toBe(msgs);
  });
});

describe("applySwitchBranch", () => {
  it("eski dala geri döner ve zincirini geri yükler", () => {
    const edited = applyEditBranch([u("merhaba"), a("yanıt1")], 0, "selam");
    // yeni dala bir yanıt eklenmiş gibi simüle et
    const withReply = [...edited, a("yanıt2")];
    withReply[0] = edited[0];
    const back = applySwitchBranch(withReply, 0, 0);
    expect(back[0].content).toBe("merhaba");
    expect(back).toHaveLength(2);
    expect(back[1].content).toBe("yanıt1");
    expect(back[0].branchIndex).toBe(0);
  });

  it("aynı dala geçince değişmez", () => {
    const edited = applyEditBranch([u("a")], 0, "b");
    expect(applySwitchBranch(edited, 0, edited[0].branchIndex!)).toBe(edited);
  });

  it("dalsız mesajda değişmez", () => {
    const msgs = [u("a"), a("b")];
    expect(applySwitchBranch(msgs, 0, 0)).toBe(msgs);
  });

  it("ileri-geri gidince içerik kaybolmaz", () => {
    const e1 = applyEditBranch([u("v1"), a("r1")], 0, "v2");      // dal1 aktif
    const withR2 = [...e1, a("r2")]; withR2[0] = e1[0];
    const back0 = applySwitchBranch(withR2, 0, 0);                 // v1'e dön
    expect(back0[1].content).toBe("r1");
    const fwd1 = applySwitchBranch(back0, 0, 1);                   // v2'ye dön
    expect(fwd1[0].content).toBe("v2");
    expect(fwd1[1].content).toBe("r2");                            // r2 korunmuş
  });
});
