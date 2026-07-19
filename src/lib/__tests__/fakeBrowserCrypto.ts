/* Node'da tarayıcı `indexedDB`/`window` yok — secureKeys.ts'in gerçek AES-GCM
   yolu (`isCryptoAvailable()`) bu yüzden testlerde hep no-op'a düşerdi. Node
   20+ zaten globalThis.crypto.subtle sağlıyor; yalnızca `window`/`indexedDB`'yi
   bellek-içi sahte bir sürümle tamamlayıp gerçek şifrele→çöz yolunu koşturuyoruz.
   secureKeys.test.ts ve storeActions.test.ts (rehydrateSecrets yarış testi)
   arasında paylaşılır — bu bir test dosyası DEĞİL, vitest onu suite olarak
   çalıştırmaz (adında .test yok). */
export function installFakeBrowserCrypto() {
  const kv = new Map<string, unknown>();
  class FakeRequest {
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result: unknown;
  }
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    transaction: () => ({
      objectStore: () => ({
        get(key: string) {
          const r = new FakeRequest();
          r.result = kv.get(key);
          queueMicrotask(() => r.onsuccess?.());
          return r;
        },
        put(val: unknown, key: string) {
          const r = new FakeRequest();
          kv.set(key, val);
          queueMicrotask(() => r.onsuccess?.());
          return r;
        },
      }),
    }),
  };
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    open() {
      const req = new FakeRequest();
      req.result = fakeDb;
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  };
  (globalThis as unknown as { window: unknown }).window = { crypto: globalThis.crypto };
}

export function removeFakeBrowserCrypto() {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
  delete (globalThis as { window?: unknown }).window;
}
