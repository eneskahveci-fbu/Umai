/* "Daha güçlü model bağla" köprüsünün SAF mantığı.
   Bileşenden ayrı tutuluyor ki vitest (environment: node, jsdom YOK) ile
   doğrudan test edilebilsin — bkz. CLAUDE.md'deki "saf mantığı lib/'e çıkar"
   kuralı. */

import { PRESETS, type FreeKeyOption } from "./constants";
import type { Config, ModelProfile } from "./types";

/* DİKKAT — anahtarsız varsayılanın İKİ ayrı id'si var (tarihsel):
     • DEFAULT_CONFIG.models[0].id → "pollinations-free"
     • POLLINATIONS_DEFAULT_MODEL.id → "craft-default-pollinations"
   store.ts, depoda config yokken (misafir modu / ilk açılış) İKİNCİSİNİ
   kullanıyor. Bu yüzden id eşleştirmek kırılgan: köprü ilk kez tam da onu
   görmesi gereken kullanıcıda görünmüyordu. Kontrol artık ANLAMSAL — "sağlayıcı
   pollinations ve anahtar yok" — ve yeni bir varsayılan id eklense de çalışır. */
export const KEYLESS_DEFAULT_IDS = ["pollinations-free", "craft-default-pollinations"] as const;

/** Bu profil, kullanıcının kendi eklemediği anahtarsız gömülü varsayılan mı? */
export function isKeylessDefault(m: Pick<ModelProfile, "provider" | "apiKey">): boolean {
  return m.provider === "pollinations" && !m.apiKey;
}

/**
 * Köprü gösterilmeli mi?
 *
 * YALNIZCA kullanıcının elinde kendi eklediği hiçbir model yoksa. Kendi
 * modelini eklemiş biri bunu bir daha görmemeli — aksi hâlde davet değil,
 * dırdır olur.
 */
export function shouldOfferStrongerModel(config: Pick<Config, "models">): boolean {
  const models = config.models ?? [];
  if (models.length === 0) return true;
  return models.every(isKeylessDefault);
}

/** Yapıştırılan anahtarı temizler: görünmez boşluklar, tırnaklar, "KEY=" önekleri. */
export function normalizeKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^[A-Z_]+\s*=\s*/, "")
    .replace(/\s+/g, "");
}

export type KeyCheck = { ok: true } | { ok: false; reason: string };

/**
 * Anahtarı KABA biçim kontrolünden geçirir. Amaç geçerliliği kanıtlamak değil
 * (bunu ancak sağlayıcı yapabilir) — kullanıcının yanlışlıkla anahtar yerine
 * URL/e-posta/boş metin yapıştırdığı bariz durumları erkenden yakalamak.
 * Ön ek tutmuyorsa REDDETMEZ, uyarır: sağlayıcılar ön eklerini zamanla
 * değiştiriyor ve geçerli bir anahtarı reddetmek, uyarmaktan çok daha kötü.
 */
export function checkKey(key: string, opt: Pick<FreeKeyOption, "keyPrefix" | "name">): KeyCheck {
  if (!key) return { ok: false, reason: "Anahtar boş." };
  if (key.length < 12) return { ok: false, reason: "Bu bir API anahtarı için fazla kısa." };
  if (/^https?:\/\//i.test(key)) return { ok: false, reason: "Bu bir adres — anahtarın kendisini yapıştır." };
  if (key.includes("@") && key.includes(".")) return { ok: false, reason: "Bu bir e-posta adresi gibi görünüyor." };
  if (!key.startsWith(opt.keyPrefix)) {
    return { ok: false, reason: `${opt.name} anahtarları genelde "${opt.keyPrefix}" ile başlar — yine de deneyebilirsin.` };
  }
  return { ok: true };
}

/** checkKey'in "uyarı" ile "gerçek hata"yı ayırması için: ön ek uyuşmazlığı engel değildir. */
export function isBlockingProblem(check: KeyCheck, key: string, opt: Pick<FreeKeyOption, "keyPrefix">): boolean {
  if (check.ok) return false;
  return key.startsWith(opt.keyPrefix) || key.length < 12 || /^https?:\/\//i.test(key) || !key;
}

/**
 * Seçilen sağlayıcı + anahtardan yeni bir model profili üretir ve onu AKTİF
 * yaparak config'i döndürür. Anahtarsız varsayılan SİLİNMEZ: sağlayıcı kotası
 * dolduğunda fallback zinciri ona geri düşebilmeli (ürünün "asla limite
 * çarpma" vaadi buna dayanıyor).
 */
export function connectModel(
  config: Config,
  opt: FreeKeyOption,
  rawKey: string,
  now: number = Date.now(),
): Config {
  const preset = PRESETS[opt.provider];
  const profile: ModelProfile = {
    id: `${opt.provider}-${now.toString(36)}`,
    label: opt.name,
    provider: opt.provider,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: normalizeKey(rawKey),
    updatedAt: now,
  };
  return {
    ...config,
    models: [...(config.models ?? []), profile],
    activeModelId: profile.id,
  };
}
