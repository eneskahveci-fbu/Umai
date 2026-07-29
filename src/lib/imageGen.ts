/* BYOK görsel üretimi — metindeki çok-sağlayıcılı felsefenin görsele taşınması.
   Kullanıcının EKLEDİĞİ modellerden görüntü-yetenekli ilk sağlayıcı seçilir,
   anahtar istemcide çözülür ve mevcut /api/image proxy'sine (sunucu yalnız
   iletir, anahtar saklanmaz) gönderilir. Anahtar yoksa ya da üretim başarısız
   olursa çağıran Pollinations'a (anahtarsız taban) düşer — fallback.ts'teki
   metin zinciriyle aynı "istek asla düşmez" sözleşmesi. */

import type { Config, ModelProfile } from "./types";
import { resolveModelApiKey } from "./secureKeys";

/* Öncelik sırası: kalite/hız dengesi — Gemini (native, hızlı) → OpenAI
   (gpt-image-1) → xAI (grok-2-image) → NVIDIA NIM (flux.1-dev; canlı test
   edilmiş, ~5 sn) → HF (FLUX.1-schnell, cold-start'ta 503 dönebilir). */
export const IMAGE_PROVIDERS = ["gemini", "openai", "xai", "nvidia", "hf"] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export const IMAGE_PROVIDER_LABEL: Record<ImageProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  xai: "xAI",
  nvidia: "NVIDIA NIM",
  hf: "Hugging Face",
};

/** Kullanıcının modelleri arasından görüntü-yetenekli ilk sağlayıcının modelini
    seçer (öncelik sırasıyla). SAF — anahtar çözümü çağıranda. */
export function pickImageModel(models: ModelProfile[]): ModelProfile | null {
  for (const p of IMAGE_PROVIDERS) {
    const m = models.find((x) => x.provider === p);
    if (m) return m;
  }
  return null;
}

/** Kullanıcının eklediği TÜM görüntü-yetenekli modelleri, öncelik sırasıyla
    (IMAGE_PROVIDERS — kalite/hız dengesine göre en iyiden en kötüye) anahtarı
    ÇÖZÜLMÜŞ hâlde döner. "Yedek zincir" (config.imageFallbackChain) açıkken
    çağıran bunu sırayla dener; kapalıyken (varsayılan) yalnız pickImageProvider
    ile seçilen TEK adayı dener — davranış değişmez. `exclude` verilirse o
    sağlayıcı listeden çıkarılır (çağıran onu zaten ayrı denediyse tekrar
    denenmesin diye — pickImageProvider'ın auto/pin mantığıyla çakışmaz). */
export async function buildImageFallbackChain(
  config: Config,
  exclude?: ImageProvider,
): Promise<{ provider: ImageProvider; apiKey: string }[]> {
  const out: { provider: ImageProvider; apiKey: string }[] = [];
  for (const p of IMAGE_PROVIDERS) {
    if (p === exclude) continue;
    const m = config.models.find((x) => x.provider === p);
    if (!m) continue;
    const apiKey = await resolveModelApiKey(m, config.providerKeys);
    if (apiKey) out.push({ provider: p, apiKey });
  }
  return out;
}

function isImageProvider(p: string): p is ImageProvider {
  return (IMAGE_PROVIDERS as readonly string[]).includes(p);
}

/** Config'ten kullanılabilir BYOK görsel sağlayıcısını + çözülmüş anahtarını
    döndürür; uygun model veya anahtar yoksa null (→ Pollinations tabanı).
    `config.imageModelProvider` (Ayarlar → Model → Görsel üretimi) tercihini
    onurlandırır: "pollinations" ise BYOK'a hiç bakmadan direkt null döner
    (kullanıcı ücretsiz tabanı bilerek seçmiştir); belirli bir sağlayıcı
    sabitlenmişse önce ONU dener, model/anahtar artık yoksa "auto" davranışa
    sessizce düşer. "auto" (varsayılan, kullanıcı kararı): kullanıcı beklentisi
    "hangi model seçiliyse görsel de onunla üretilsin" — önce O AN AKTİF sohbet
    modelinin sağlayıcısı görüntü-yetenekliyse ONU kullanır; değilse öncelik
    sıralı listeye (gemini→openai→xai→hf, bkz. pickImageModel) düşer. */
export async function pickImageProvider(config: Config): Promise<{ provider: ImageProvider; apiKey: string } | null> {
  const pref = config.imageModelProvider ?? "auto";
  if (pref === "pollinations") return null;
  if (pref !== "auto") {
    const pinned = config.models.find((m) => m.provider === pref);
    if (pinned) {
      const apiKey = await resolveModelApiKey(pinned, config.providerKeys);
      if (apiKey) return { provider: pref, apiKey };
    }
  }
  const active = config.models.find((m) => m.id === config.activeModelId);
  if (active && isImageProvider(active.provider)) {
    const apiKey = await resolveModelApiKey(active, config.providerKeys);
    if (apiKey) return { provider: active.provider, apiKey };
  }
  const model = pickImageModel(config.models);
  if (!model) return null;
  const apiKey = await resolveModelApiKey(model, config.providerKeys);
  if (!apiKey) return null;
  return { provider: model.provider as ImageProvider, apiKey };
}

/** /api/image üzerinden üretim — data URL döndürür, hatada throw eder. */
export async function generateImageBYOK(
  prompt: string,
  provider: ImageProvider,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey, prompt }),
    signal,
  });
  const data = await res.json().catch(() => ({})) as { image?: string; error?: string };
  if (!res.ok || !data.image) throw new Error(data.error || `Görüntü üretimi başarısız (${res.status}).`);
  return data.image;
}

/** Büyük data-URL görselleri (PNG ~1-2MB) localStorage kalıcılığını şişirmesin
    diye tarayıcıda JPEG'e sıkıştırır (canvas). Başarısızlıkta girdiyi döndürür. */
export function compressDataUrl(dataUrl: string, maxDim = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", quality);
          /* Sıkıştırma büyüttüyse (küçük/az renkli görsel) orijinali koru. */
          resolve(out.length < dataUrl.length ? out : dataUrl);
        } catch { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch { resolve(dataUrl); }
  });
}
