/* API anahtarlarını tarayıcıda AES-GCM ile şifreli saklama katmanı.
 *
 * MUTLAK GÜVENLİK İLKESİ (geriye dönük uyum):
 *  - decryptField() prefix'siz (eski/düz metin) değeri AYNEN döndürür → eski
 *    veri ASLA bozulmaz/kaybolmaz.
 *  - Kripto/IndexedDB yoksa katman devre dışı kalır, uygulama düz metinle eskisi
 *    gibi çalışır.
 *  - Şifreleme anahtarı IndexedDB'de (non-extractable) tutulur; localStorage ile
 *    aynı dayanıklılıkta (birlikte temizlenir).
 */

import type { Config } from "./types";

const ENC_PREFIX = "enc:1:";
const DB_NAME = "craftai_secure";
const STORE = "keys";
const KEY_ID = "aesKey";

export function isCryptoAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    !!window.crypto?.subtle
  );
}

export function isEncrypted(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(ENC_PREFIX);
}

/* ── IndexedDB: tek bir non-extractable AES-GCM anahtarını getir/oluştur ── */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    tx.onsuccess = () => resolve(tx.result as T | undefined);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbPut(key: string, val: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(val, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = await idbGet<CryptoKey>(KEY_ID);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await idbPut(KEY_ID, key);
    return key;
  })();
  return keyPromise;
}

const b64 = {
  enc: (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

/* Bir değeri şifrele. Boş/şifreli ise olduğu gibi döner. */
export async function encryptField(plain: string): Promise<string> {
  if (!plain || isEncrypted(plain) || !isCryptoAvailable()) return plain;
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    );
    return `${ENC_PREFIX}${b64.enc(iv.buffer)}:${b64.enc(ct)}`;
  } catch {
    return plain; // şifreleme başarısız → düz metni koru (veri kaybetme > düz metin)
  }
}

/* Bir değeri çöz. Prefix yoksa (düz metin) AYNEN döner → geriye uyum garantisi.
   Çözme hata verirse de orijinal değeri döndürür (veri kaybetmemek için). */
export async function decryptField(token: string): Promise<string> {
  if (!isEncrypted(token) || !isCryptoAvailable()) return token;
  try {
    const [, ivb64, ctb64] = token.split(":");
    const key = await getKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64.dec(ivb64) },
      key,
      b64.dec(ctb64),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return token; // çözülemezse orijinali koru — asla boşaltma
  }
}

/* ── Config seviyesinde gizli alanlar ──────────────────────────────────────
   Şifrelenen/çözülen alanlar: models[].apiKey, providerKeys, githubAccounts[].token,
   gitlabAccounts[].token. Diğer her şey AYNEN korunur. Kripto yoksa Config
   değişmeden döner (geriye uyum). */
async function mapConfigSecrets(
  cfg: Config,
  fn: (s: string) => Promise<string>,
): Promise<Config> {
  if (!isCryptoAvailable()) return cfg;
  const models = await Promise.all(
    (cfg.models ?? []).map(async (m) => ({ ...m, apiKey: m.apiKey ? await fn(m.apiKey) : m.apiKey })),
  );
  const providerKeys: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.providerKeys ?? {})) {
    providerKeys[k] = v ? await fn(v) : (v as string);
  }
  const githubAccounts = await Promise.all(
    (cfg.githubAccounts ?? []).map(async (a) => ({ ...a, token: a.token ? await fn(a.token) : a.token })),
  );
  const gitlabAccounts = await Promise.all(
    (cfg.gitlabAccounts ?? []).map(async (a) => ({ ...a, token: a.token ? await fn(a.token) : a.token })),
  );
  return {
    ...cfg,
    models,
    providerKeys: providerKeys as Config["providerKeys"],
    githubAccounts,
    gitlabAccounts,
  };
}

export const encryptConfigSecrets = (cfg: Config) => mapConfigSecrets(cfg, encryptField);
export const decryptConfigSecrets = (cfg: Config) => mapConfigSecrets(cfg, decryptField);

/* Config'te şifrelenmemiş (düz metin) bir gizli alan var mı? (migrasyon tetiği) */
export function hasPlaintextSecret(cfg: Config): boolean {
  const vals = [
    ...(cfg.models ?? []).map((m) => m.apiKey),
    ...Object.values(cfg.providerKeys ?? {}),
    ...(cfg.githubAccounts ?? []).map((a) => a.token),
    ...(cfg.gitlabAccounts ?? []).map((a) => a.token),
  ];
  return vals.some((v) => typeof v === "string" && v.length > 0 && !isEncrypted(v));
}
