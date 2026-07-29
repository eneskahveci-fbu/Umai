import { describe, expect, it, vi } from "vitest";
import { scheduleReloadAfterStreaming } from "../sw-register";

/* Bug: yeni bir sürüm dağıtıldığı AN, kullanıcı tam o sırada bir yanıt
   akışının ortasında olsa bile sayfa aniden yenileniyordu — henüz
   kaydedilmemiş yanıt kayboluyor, kullanıcıya "sohbetten aniden atıldım,
   tarayıcı kendiliğinden yeniden başladı gibi" hissettiriyordu. */

describe("scheduleReloadAfterStreaming", () => {
  it("akış YOKKEN reload'u hemen çağırır (eski davranış korunur)", () => {
    const reload = vi.fn();
    const subscribe = vi.fn();
    scheduleReloadAfterStreaming({ isStreaming: () => false, subscribe, reload });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("akış SÜRERKEN reload'u ERTELER — hemen çağırmaz", () => {
    const reload = vi.fn();
    const subscribe = vi.fn(() => () => {});
    scheduleReloadAfterStreaming({ isStreaming: () => true, subscribe, reload });
    expect(reload).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("akış BİTİNCE (streaming false olunca) reload çağrılır ve abonelik iptal edilir", () => {
    const reload = vi.fn();
    let listener: (() => void) | null = null;
    const unsub = vi.fn();
    let streaming = true;
    const subscribe = vi.fn((cb: () => void) => { listener = cb; return unsub; });

    scheduleReloadAfterStreaming({ isStreaming: () => streaming, subscribe, reload });
    expect(reload).not.toHaveBeenCalled();

    /* Akış hâlâ sürüyorken bir state değişikliği daha olsa reload TETİKLENMEZ. */
    listener!();
    expect(reload).not.toHaveBeenCalled();

    streaming = false;
    listener!();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("streaming sonsuza dek takılı kalırsa güvenlik ağı (safetyMs) yine de reload eder", () => {
    vi.useFakeTimers();
    try {
      const reload = vi.fn();
      const unsub = vi.fn();
      const subscribe = vi.fn(() => unsub);
      scheduleReloadAfterStreaming({ isStreaming: () => true, subscribe, reload, safetyMs: 1000 });
      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(unsub).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reload yalnız BİR KEZ tetiklenir (hem listener hem güvenlik ağı yarışsa bile)", () => {
    vi.useFakeTimers();
    try {
      const reload = vi.fn();
      let listener: (() => void) | null = null;
      let streaming = true;
      const subscribe = vi.fn((cb: () => void) => { listener = cb; return () => {}; });
      scheduleReloadAfterStreaming({ isStreaming: () => streaming, subscribe, reload, safetyMs: 1000 });

      streaming = false;
      listener!(); // önce listener tetiklenir
      vi.advanceTimersByTime(2000); // güvenlik ağı da dolar
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
