/* Evrimsel Model Seçici (Sakana/Fugu ilhami).
   Her istek sonrası çok-boyutlu fitness skoru hesaplar ve görev türüne göre
   en uygun modeli önerir. Saf (test edilebilir) + localStorage kalıcılığı.
   Config flag: config.evolutionaryRouter (default false, opt-in).

   Fitness = (başarı oranı) × (hız skoru) × (token verimliliği)
   Her boyut EMA ile öğrenilir (α = 0.25). Tasarım: ağırlıksız çarpım →
   tek boyuttaki başarısız model tüm ürünü düşürür (doğal ayıklanma). */

import type { Provider } from "./types";

export type TaskCategory = "code" | "doc" | "analyze" | "chat" | "search" | "other";

export interface FitnessRecord {
  provider: Provider;
  model: string;
  /** EMA başarı oranı [0..1]. */
  successRate: number;
  /** EMA normalize hız skoru [0..1] (düşük gecikme = yüksek skor). */
  speedScore: number;
  /** EMA token verimliliği [0..1] (çıktı/girdi oranı — bilgi yoğunluğu). */
  tokenEfficiency: number;
  /** Görev kategorisi bazlı sample sayıları. */
  taskSamples: Partial<Record<TaskCategory, number>>;
  /** Son güncelleme ms. */
  updatedAt: number;
  samples: number;
}

const STORE_KEY = "craftai_fitness";
const EMA_ALPHA = 0.25;
const REF_LATENCY_MS = 3000; // bu altı = tam puan

// ---- Saf fonksiyonlar (test edilebilir) ------------------------------------

export function computeFitness(r: FitnessRecord): number {
  return r.successRate * r.speedScore * r.tokenEfficiency;
}

export function updateFitness(
  prev: FitnessRecord | undefined,
  provider: Provider,
  model: string,
  latencyMs: number,
  tokenIn: number,
  tokenOut: number,
  ok: boolean,
  taskType: TaskCategory,
): FitnessRecord {
  const base: FitnessRecord = prev ?? {
    provider,
    model,
    successRate: 0.7,
    speedScore: 0.7,
    tokenEfficiency: 0.7,
    taskSamples: {},
    updatedAt: 0,
    samples: 0,
  };
  const successRate = base.successRate + EMA_ALPHA * ((ok ? 1 : 0) - base.successRate);
  const rawSpeed = Math.max(0, 1 - latencyMs / (REF_LATENCY_MS * 4));
  const speedScore = base.speedScore + EMA_ALPHA * (rawSpeed - base.speedScore);
  const rawEff = tokenIn > 0 ? Math.min(1, tokenOut / tokenIn) : 0.5;
  const tokenEfficiency = base.tokenEfficiency + EMA_ALPHA * (rawEff - base.tokenEfficiency);
  const taskSamples: Partial<Record<TaskCategory, number>> = {
    ...base.taskSamples,
    [taskType]: (base.taskSamples[taskType] ?? 0) + 1,
  };
  return {
    provider,
    model,
    successRate: Math.max(0, Math.min(1, successRate)),
    speedScore: Math.max(0, Math.min(1, speedScore)),
    tokenEfficiency: Math.max(0, Math.min(1, tokenEfficiency)),
    taskSamples,
    updatedAt: Date.now(),
    samples: base.samples + 1,
  };
}

export type FitnessStore = Record<string, FitnessRecord>;

function fitnessKey(provider: Provider, model: string): string {
  return `${provider}|${model}`;
}

// ---- localStorage kalıcılığı (SSR-safe) ------------------------------------

let _cache: FitnessStore | null = null;

export function loadFitness(): FitnessStore {
  if (_cache) return { ..._cache };
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORE_KEY);
    _cache = raw ? (JSON.parse(raw) as FitnessStore) : {};
    return { ..._cache };
  } catch { return {}; }
}

function saveFitness(store: FitnessStore): void {
  _cache = { ...store };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch { /* yok say */ }
}

/** Bir istek sonucunu fitness deposuna kaydeder. */
export function recordFitnessOutcome(
  provider: Provider,
  model: string,
  latencyMs: number,
  tokenIn: number,
  tokenOut: number,
  ok: boolean,
  taskType: TaskCategory = "other",
): void {
  const store = loadFitness();
  const key = fitnessKey(provider, model);
  store[key] = updateFitness(store[key], provider, model, latencyMs, tokenIn, tokenOut, ok, taskType);
  saveFitness(store);
}

/** Verilen provider+model çifti için fitness puanını döndürür. */
export function getFitnessScore(provider: Provider, model: string): number {
  const store = loadFitness();
  const rec = store[fitnessKey(provider, model)];
  return rec ? computeFitness(rec) : 0.7; // bilinmeyene iyimser başlangıç
}

/** Tüm fitness kayıtlarını döndürür (SettingsModal'da göstermek için). */
export function getAllFitnessRecords(): FitnessRecord[] {
  return Object.values(loadFitness());
}
