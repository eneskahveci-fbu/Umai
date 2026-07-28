/* Model kalite sıralaması (en güçlüden en zayıfa) — TEK kaynak. Önceden bu
   liste yalnız store.ts'in strongestModel()'inde (Fusion taslak seçimi için)
   gömülüydü; Ayarlar'daki "kalite öncelikli" yedek zinciri de (bkz. fallback.ts
   buildQualityFallbackChain) AYNI listeyi kullanıyor — ikisi asla birbirinden
   sapmaz. Sıra "ücretli mi ücretsiz mi" değil, YALNIZ bilinen model gücüne göre;
   listede olmayan (yerel/özel/tanınmayan) modeller sona düşer — F2'nin "yanlış
   iyimser tahmin, temkinli tahminden daha kötü" dersiyle aynı yaklaşım. */
export const MODEL_QUALITY_ORDER: readonly string[] = [
  "opus", "gpt-5", "o4", "o3", "deepseek-reasoner", "sonnet", "claude-3.7",
  "grok-4", "gpt-4.1", "gemini-2.5-pro", "gpt-4o", "deepseek", "gemini-2.5",
  "llama-3.3-70b", "70b", "qwen3", "mistral-large", "codestral",
];

/** Modelin kalite sırasındaki konumu (küçük = daha güçlü); tanınmıyorsa
    listenin sonrasına (Infinity) düşer. */
export function modelQualityRank(model: string, label: string): number {
  const hay = `${model} ${label}`.toLowerCase();
  const idx = MODEL_QUALITY_ORDER.findIndex((key) => hay.includes(key));
  return idx === -1 ? Infinity : idx;
}

/** Verilen modelleri en iyiden en kötüye sıralar (saf, kararlı sort —
    eşit sıradaki modellerin göreli sırası korunur). */
export function sortByQuality<T extends { model: string; label: string }>(models: readonly T[]): T[] {
  return models
    .map((m, i) => ({ m, i }))
    .sort((a, b) => modelQualityRank(a.m.model, a.m.label) - modelQualityRank(b.m.model, b.m.label) || a.i - b.i)
    .map(({ m }) => m);
}
