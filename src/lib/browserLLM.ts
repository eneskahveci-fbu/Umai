/* Tarayıcı-içi (yerel) sohbet modeli — transformers.js + WebGPU/WASM.
   Gerçek "yerel/sınırsız" model: hiçbir sunucuya/API'ye istek gitmez (model
   ağırlıkları hariç — o da yalnız İLK kullanımda, tek seferlik indirilir ve
   tarayıcının kendi önbelleğinde kalır). Qwen2.5-1.5B-Instruct kullanılır
   (onnx-community'nin transformers.js için resmi ONNX derlemesi) — bu
   boyuttaki modeller arasında Türkçe dahil çok dilli performansı iyi olanı;
   Llama 3.2 1B/3B'nin resmi çok-dilli listesi Türkçe'yi kapsamıyor, SmolLM2
   ağırlıklı İngilizce eğitilmiş. WebGPU varsa kullanılır (hızlı); yoksa
   WASM'a düşülür (yavaş ama küçük modelde yine çalışır).

   Bilinçli sınırlama: yalnız düz sohbet (araçsız/tool-free) — 1.5B parametreli
   bir model güvenilir tool-calling yapamaz, bu yüzden CoderView.tsx bu
   sağlayıcıyı toolsWanted/Fusion/Swarm'dan tamamen ayrı, kendi başına bir
   dal olarak ele alır (bkz. send()'teki "provider === 'browser'" bloğu). */

export const BROWSER_MODEL_ID = "onnx-community/Qwen2.5-1.5B-Instruct";
/** Kaba indirme boyutu (MB) — kullanıcıya indirme öncesi göstermek için. */
export const BROWSER_MODEL_SIZE_MB = 1200;

export interface BrowserLLMMessage {
  role: string;
  content: string;
}

interface MinimalTokenizer {
  // transformers.js TextStreamer bunu bekler; gerçek şekli burada önemli değil.
  [key: string]: unknown;
}

interface MinimalGenerator {
  tokenizer: MinimalTokenizer;
  (
    messages: BrowserLLMMessage[],
    opts: Record<string, unknown>,
  ): Promise<{ generated_text: BrowserLLMMessage[] }[]>;
}

interface ProgressEvent {
  status: string;
  progress?: number;
}

let generatorPromise: Promise<MinimalGenerator | null> | null = null;
let lastProgress = 0;

/** Tarayıcı ortamı mı (SSR/Node'da her zaman false). */
export function browserLLMSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

/** WebGPU var mı — yoksa transformers.js otomatik WASM'a düşer (daha yavaş). */
export function browserLLMHasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** Model indirme ilerlemesi (0-1). Henüz başlamadıysa/bilinmiyorsa 0. */
export function getBrowserLLMLoadProgress(): number {
  return lastProgress;
}

/** Model zaten belleğe yüklendi mi (bu sekmede) — tekrar indirme/yükleme
    olmadan hemen kullanılabilir mi? */
export function isBrowserLLMLoaded(): boolean {
  return generatorPromise !== null;
}

async function getGenerator(onProgress?: (pct: number) => void): Promise<MinimalGenerator | null> {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      try {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = false;
        const useWebGPU = browserLLMHasWebGPU();
        const gen = await pipeline("text-generation", BROWSER_MODEL_ID, {
          dtype: useWebGPU ? "q4f16" : "q4",
          device: useWebGPU ? "webgpu" : "wasm",
          progress_callback: (p: ProgressEvent) => {
            if (typeof p.progress === "number") {
              lastProgress = p.progress / 100;
              onProgress?.(lastProgress);
            }
          },
        });
        lastProgress = 1;
        return gen as unknown as MinimalGenerator;
      } catch {
        generatorPromise = null; // başarısız yükleme tekrar denenebilsin
        return null;
      }
    })();
  }
  return generatorPromise;
}

/** Sohbet mesajlarını tarayıcıda üretir, metin geldikçe onDelta ile bildirir.
    Model yüklenemezse (WebGPU/WASM desteklenmiyor, bellek yetersiz, ağ
    hatası vb.) null döner — çağıran taraf bunu "kullanılamıyor" say
    malı ve kullanıcıya nazik bir hata göstermeli. */
export async function runBrowserLLM(
  messages: BrowserLLMMessage[],
  onDelta: (text: string) => void,
  opts: { onProgress?: (pct: number) => void } = {},
): Promise<string | null> {
  if (!browserLLMSupported()) return null;
  const generator = await getGenerator(opts.onProgress);
  if (!generator) return null;
  try {
    const { TextStreamer } = await import("@huggingface/transformers");
    let full = "";
    const streamer = new TextStreamer(generator.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        full += text;
        onDelta(text);
      },
    });
    await generator(messages, {
      max_new_tokens: 1024,
      do_sample: false,
      streamer,
    });
    return full;
  } catch {
    return null;
  }
}
