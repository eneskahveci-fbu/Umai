import { describe, expect, it, vi } from "vitest";
import { runAfterStreaming } from "../streamGate";

/* Bug: yeni bir sürüm dağıtıldığı AN, kullanıcı tam o sırada bir yanıt
   akışının ortasında olsa bile sayfa aniden yenileniyordu — henüz
   kaydedilmemiş yanıt kayboluyor, kullanıcıya "sohbetten aniden atıldım,
   tarayıcı kendiliğinden yeniden başladı gibi" hissettiriyordu.

   Aynı kapı artık terminal/kod çıktısının ajana geri beslenmesinde de
   kullanılıyor (H5): akışın ortasında sohbete kullanıcı mesajı eklenmesi
   modelin cevabını kullanıcı balonunda gösteriyordu. */

describe("runAfterStreaming", () => {
  it("akış YOKKEN hemen çalıştırır", () => {
    const run = vi.fn();
    const subscribe = vi.fn();
    runAfterStreaming({ isStreaming: () => false, subscribe, run });
    expect(run).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("akış SÜRERKEN ERTELER — hemen çalıştırmaz", () => {
    const run = vi.fn();
    const subscribe = vi.fn(() => () => {});
    runAfterStreaming({ isStreaming: () => true, subscribe, run });
    expect(run).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("akış BİTİNCE çalıştırır ve aboneliği iptal eder", () => {
    const run = vi.fn();
    let listener: (() => void) | null = null;
    const unsub = vi.fn();
    let streaming = true;
    const subscribe = vi.fn((cb: () => void) => { listener = cb; return unsub; });

    runAfterStreaming({ isStreaming: () => streaming, subscribe, run });
    expect(run).not.toHaveBeenCalled();

    /* Akış hâlâ sürüyorken bir state değişikliği daha olsa TETİKLENMEZ. */
    listener!();
    expect(run).not.toHaveBeenCalled();

    streaming = false;
    listener!();
    expect(run).toHaveBeenCalledTimes(1);
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("safetyMs VERİLİRSE güvenlik ağı çalışır", () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const unsub = vi.fn();
      const subscribe = vi.fn(() => unsub);
      runAfterStreaming({ isStreaming: () => true, subscribe, run, safetyMs: 1000 });
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(run).toHaveBeenCalledTimes(1);
      expect(unsub).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  /* H7: güvenlik ağı artık VARSAYILAN DEĞİL. Terminal çıktısını sohbete
     eklemek gibi yıkıcı işler, takılı kalmış bir `streaming` bayrağı yüzünden
     akışın ortasına düşmemeli — orada süresiz beklemek doğru davranıştır. */
  it("safetyMs VERİLMEZSE hiç zamanlayıcı kurulmaz — süresiz bekler", () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const subscribe = vi.fn(() => () => {});
      runAfterStreaming({ isStreaming: () => true, subscribe, run });
      vi.advanceTimersByTime(10 * 60_000);
      expect(run).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("yalnız BİR KEZ tetiklenir (dinleyici ile güvenlik ağı yarışsa bile)", () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      let listener: (() => void) | null = null;
      let streaming = true;
      const subscribe = vi.fn((cb: () => void) => { listener = cb; return () => {}; });
      runAfterStreaming({ isStreaming: () => streaming, subscribe, run, safetyMs: 1000 });

      streaming = false;
      listener!(); // önce dinleyici tetiklenir
      vi.advanceTimersByTime(2000); // güvenlik ağı da dolar
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
