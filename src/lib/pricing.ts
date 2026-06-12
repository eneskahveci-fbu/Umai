export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/* Anahtarlar substring eşleşmesiyle aranır (getModelPrice) — daha uzun/özgül
   anahtarlar kısa olanlardan ÖNCE gelmeli (örn. flash-lite, flash'tan önce). */
const PRICES: Record<string, ModelPrice> = {
  // DeepSeek
  "deepseek-chat": { inputPerMTok: 0.27, outputPerMTok: 1.10 },
  "deepseek-coder": { inputPerMTok: 0.14, outputPerMTok: 0.28 },
  "deepseek-reasoner": { inputPerMTok: 0.55, outputPerMTok: 2.19 },
  // OpenAI
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.60 },
  "gpt-4o": { inputPerMTok: 2.50, outputPerMTok: 10.00 },
  "gpt-oss-120b": { inputPerMTok: 0.15, outputPerMTok: 0.75 },
  "gpt-oss-20b": { inputPerMTok: 0.10, outputPerMTok: 0.50 },
  // Anthropic — güncel nesil
  "claude-fable-5": { inputPerMTok: 10.00, outputPerMTok: 50.00 },
  "claude-opus-4-8": { inputPerMTok: 5.00, outputPerMTok: 25.00 },
  "claude-opus-4-7": { inputPerMTok: 5.00, outputPerMTok: 25.00 },
  "claude-opus-4-6": { inputPerMTok: 5.00, outputPerMTok: 25.00 },
  "claude-opus-4-5": { inputPerMTok: 5.00, outputPerMTok: 25.00 },
  "claude-sonnet-4-6": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-sonnet-4-5": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-haiku-4-5": { inputPerMTok: 1.00, outputPerMTok: 5.00 },
  // Anthropic — eski
  "claude-3-5-sonnet": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-3-5-haiku": { inputPerMTok: 0.80, outputPerMTok: 4.00 },
  // Meta / Qwen / Moonshot (Groq, Together vb. ortalama fiyatları)
  "llama-3.3-70b": { inputPerMTok: 0.59, outputPerMTok: 0.79 },
  "llama-3.1-70b": { inputPerMTok: 0.59, outputPerMTok: 0.79 },
  "llama-3.1-8b": { inputPerMTok: 0.06, outputPerMTok: 0.06 },
  "qwen3-32b": { inputPerMTok: 0.29, outputPerMTok: 0.59 },
  "qwen-2.5-coder-32b": { inputPerMTok: 0.18, outputPerMTok: 0.18 },
  "qwen-2.5-72b": { inputPerMTok: 0.40, outputPerMTok: 0.40 },
  "kimi-k2": { inputPerMTok: 1.00, outputPerMTok: 3.00 },
  // Mistral
  "mistral-large": { inputPerMTok: 2.00, outputPerMTok: 6.00 },
  "codestral": { inputPerMTok: 0.30, outputPerMTok: 0.90 },
  // Google Gemini
  "gemini-2.5-flash-lite": { inputPerMTok: 0.10, outputPerMTok: 0.40 },
  "gemini-2.5-flash": { inputPerMTok: 0.30, outputPerMTok: 2.50 },
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10.00 },
  "gemini-2.0-flash": { inputPerMTok: 0.10, outputPerMTok: 0.40 },
  "gemini-1.5-pro": { inputPerMTok: 1.25, outputPerMTok: 5.00 },
  "gemini-1.5-flash": { inputPerMTok: 0.075, outputPerMTok: 0.30 },
  // xAI
  "grok-4": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "grok-3-mini": { inputPerMTok: 0.30, outputPerMTok: 0.50 },
  "grok-3": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
};

export function getModelPrice(model: string): ModelPrice | null {
  const lower = model.toLowerCase();
  for (const [key, price] of Object.entries(PRICES)) {
    if (lower.includes(key)) return price;
  }
  return null;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = getModelPrice(model);
  if (!price) return null;
  return (
    (inputTokens / 1_000_000) * price.inputPerMTok +
    (outputTokens / 1_000_000) * price.outputPerMTok
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
