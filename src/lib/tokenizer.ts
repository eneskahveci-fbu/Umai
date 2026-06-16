/* Gerçek token sayacı (gpt-tokenizer, cl100k_base — GPT-3.5/4 ailesi).
   Bundle'ı şişirmemek için TEMBEL yüklenir: yalnızca sağlayıcı gerçek `usage`
   döndürmediğinde (fallback) çağrılır. Yüklenene kadar/başarısızsa karakter
   tahminine düşer. */

type Encoder = (s: string) => number[];
let encoder: Encoder | null = null;
let loading: Promise<void> | null = null;

function rough(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/** Metnin token sayısını döndürür (gerçek tokenizer; yüklenemezse tahmin). */
export async function countTokens(text: string): Promise<number> {
  if (!text) return 0;
  if (!encoder) {
    if (!loading) {
      loading = import("gpt-tokenizer")
        .then((m) => { encoder = m.encode as Encoder; })
        .catch(() => { /* tahmine düş */ });
    }
    await loading;
  }
  try {
    return encoder ? encoder(text).length : rough(text);
  } catch {
    return rough(text);
  }
}
