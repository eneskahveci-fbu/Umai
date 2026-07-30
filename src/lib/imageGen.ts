/* BYOK görsel üretimi — metindeki çok-sağlayıcılı felsefenin görsele taşınması.
   Kullanıcının EKLEDİĞİ modellerden görüntü-yetenekli ilk sağlayıcı seçilir,
   anahtar istemcide çözülür ve mevcut /api/image proxy'sine (sunucu yalnız
   iletir, anahtar saklanmaz) gönderilir. Anahtar yoksa ya da üretim başarısız
   olursa çağıran Pollinations'a (anahtarsız taban) düşer — fallback.ts'teki
   metin zinciriyle aynı "istek asla düşmez" sözleşmesi. */

import type { Config, MediaAsset, ModelProfile } from "./types";
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

/** Çözülmüş görsel sağlayıcısı: hangi sağlayıcı, hangi anahtar, hangi MODEL. */
export interface ImagePick { provider: ImageProvider; apiKey: string; model: string }

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
): Promise<ImagePick[]> {
  const out: ImagePick[] = [];
  for (const p of IMAGE_PROVIDERS) {
    if (p === exclude) continue;
    const m = config.models.find((x) => x.provider === p);
    if (!m) continue;
    const apiKey = await resolveModelApiKey(m, config.providerKeys);
    if (apiKey) out.push({ provider: p, apiKey, model: resolveImageModel(p, config.imageModelIds) });
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
export async function pickImageProvider(config: Config): Promise<ImagePick | null> {
  const pref = config.imageModelProvider ?? "auto";
  if (pref === "pollinations") return null;
  if (pref !== "auto") {
    const pinned = config.models.find((m) => m.provider === pref);
    if (pinned) {
      const apiKey = await resolveModelApiKey(pinned, config.providerKeys);
      if (apiKey) return { provider: pref, apiKey, model: resolveImageModel(pref, config.imageModelIds) };
    }
  }
  const active = config.models.find((m) => m.id === config.activeModelId);
  if (active && isImageProvider(active.provider)) {
    const apiKey = await resolveModelApiKey(active, config.providerKeys);
    if (apiKey) return { provider: active.provider, apiKey, model: resolveImageModel(active.provider, config.imageModelIds) };
  }
  const model = pickImageModel(config.models);
  if (!model) return null;
  const apiKey = await resolveModelApiKey(model, config.providerKeys);
  if (!apiKey) return null;
  const prov = model.provider as ImageProvider;
  return { provider: prov, apiKey, model: resolveImageModel(prov, config.imageModelIds) };
}

/** /api/image üzerinden üretim — data URL döndürür, hatada throw eder. */
export async function generateImageBYOK(
  prompt: string,
  provider: ImageProvider,
  apiKey: string,
  signal?: AbortSignal,
  model?: string,
): Promise<string> {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey, prompt, model: model || defaultImageModel(provider) }),
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

/* ── Kütüphane kaydı ────────────────────────────────────────────────────
   Üretilen görseli Kütüphane'ye (config.mediaAssets) ekler. SAF: yeni
   mediaAssets dizisini döndürür, kaydetmeyi çağıran yapar → birim testli.

   Kota kuralı: BYOK ve (artık) doğrulanmış Pollinations çıktıları data-URL'dir
   ve localStorage'ı hızla doldurur; bu yüzden data-URL girdileri 20 ile,
   toplam liste 200 ile sınırlanır (URL girdileri küçük olduğundan onlara
   cömert davranılır). Kural İKİ çağrı yerinde de aynı olsun diye tek yerde:
   "/gorsel" komutu ve generate_image aracı. */
export const MAX_DATA_URL_ASSETS = 20;
export const MAX_MEDIA_ASSETS = 200;

export function addMediaAsset(
  existing: readonly MediaAsset[] | undefined,
  asset: MediaAsset,
): MediaAsset[] {
  let dataCount = 0;
  return [asset, ...(existing ?? [])]
    .filter((a) => !a.url.startsWith("data:") || ++dataCount <= MAX_DATA_URL_ASSETS)
    .slice(0, MAX_MEDIA_ASSETS);
}

/* ── Sağlayıcı başına görsel MODEL kataloğu ─────────────────────────────
   Önceden her sağlayıcının modeli /api/image içinde SABİT kodluydu: kullanıcı
   ne kullanıldığını göremiyor, değiştiremiyordu. Katalog burada tek yerde
   durur; Ayarlar → Model → Görsel üretimi bunu listeler, /api/image ise gelen
   model adını BU listeye karşı DOĞRULAR (özellikle NVIDIA'da model adı URL
   yoluna girdiği için doğrulama şart — keyfi değer yol enjeksiyonu olurdu).

   `steps`: yalnız NVIDIA genai ucunun istediği alan; modele göre değişir ve
   sınırlar canlı doğrulandı (flux.1-dev "steps >= 5" ister, 25 ile ~5 sn'de
   iyi sonuç verir).

   NOT — canlı test (gerçek nvapi anahtarı): "flux.1-schnell" listeye ALINMADI.
   İstek şemasını doğruluyor (steps>4 için anında 422) ama geçerli steps=4 ile
   60 sn boyunca hiç yanıt döndürmüyor. Çalışmayan bir seçeneği menüye koymak
   kullanıcıyı yanıltırdı. Aynı şekilde sdxl-turbo / stable-diffusion-xl /
   bria-2.3 bu hesapta 404 veriyor. */
export interface ImageModelOption {
  id: string;
  label: string;
  /** Kısa açıklama — seçicide modelin altında gösterilir. */
  note?: string;
  /** NVIDIA genai ucu için adım sayısı (diğer sağlayıcılarda yok sayılır). */
  steps?: number;
}

export const IMAGE_MODELS: Record<ImageProvider, ImageModelOption[]> = {
  gemini: [
    { id: "gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Image", note: "Hızlı, native görsel üretimi" },
  ],
  openai: [
    { id: "gpt-image-1", label: "GPT Image 1", note: "En yeni, metin işlemede güçlü" },
    { id: "dall-e-3", label: "DALL·E 3", note: "Daha stilize sonuçlar" },
  ],
  xai: [
    { id: "grok-2-image", label: "Grok 2 Image" },
  ],
  nvidia: [
    { id: "black-forest-labs/flux.1-dev", label: "FLUX.1 dev", note: "Canlı test edildi — ~5 sn", steps: 25 },
  ],
  hf: [
    { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 schnell", note: "Ücretsiz; ilk istekte ısınma gerekebilir" },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", label: "Stable Diffusion XL" },
  ],
};

/** Sağlayıcının varsayılan (listedeki ilk) görsel modeli. Bilinmeyen sağlayıcı
    için "" döner — çağıran kendi sabit varsayılanını kullanabilsin. */
export function defaultImageModel(provider: string): string {
  const list = (IMAGE_MODELS as Record<string, ImageModelOption[] | undefined>)[provider];
  return list?.[0]?.id ?? "";
}

/** Kullanıcının seçtiği model; seçim yoksa ya da artık katalogda değilse
    varsayılana düşer (silinmiş/yeniden adlandırılmış modelde kilitlenme yok). */
export function resolveImageModel(
  provider: ImageProvider,
  chosen: Partial<Record<string, string>> | undefined,
): string {
  const want = chosen?.[provider];
  if (want && IMAGE_MODELS[provider].some((m) => m.id === want)) return want;
  return defaultImageModel(provider);
}

/** Model adı bu sağlayıcı için geçerli mi? (sunucu tarafı doğrulama) */
export function isKnownImageModel(provider: string, model: string): boolean {
  const list = (IMAGE_MODELS as Record<string, ImageModelOption[] | undefined>)[provider];
  return !!list?.some((m) => m.id === model);
}

/** Modelin NVIDIA adım sayısı (bilinmiyorsa güvenli varsayılan). */
export function imageModelSteps(provider: string, model: string): number {
  const list = (IMAGE_MODELS as Record<string, ImageModelOption[] | undefined>)[provider];
  return list?.find((m) => m.id === model)?.steps ?? 25;
}
