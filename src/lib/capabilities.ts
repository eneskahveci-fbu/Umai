/* Tarayıcı yetenek algılama — gelişmiş (WebGPU / WebContainers / P2P) özellikleri
   GÜVENLE kapılamak için. Hepsi savunmacı: SSR'de veya destek yoksa false döner,
   böylece ilgili özellik sessizce uykuda kalır ve canlı site asla bozulmaz.

   Şimdilik hiçbir çağıran yok — gelecekteki "çağ atlaması" fazlarının (yerel
   model çıkarımı, gerçek kod çalıştırma, P2P işbirliği) ortak güvenlik kapısı
   olarak baştan hazırlanıyor. */

/** WebGPU — tarayıcı-içi model çıkarımı (WebLLM/transformers.js) için. */
export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in (navigator as object);
}

/** WebRTC — sunucusuz P2P işbirliği (CRDT senkron) için. */
export function hasWebRTC(): boolean {
  return typeof RTCPeerConnection !== "undefined";
}

/** IndexedDB — yerel anlamsal hafıza / vektör deposu için. */
export function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Cross-origin isolation (SharedArrayBuffer) — WebContainers gerçek çalıştırma için. */
export function isCrossOriginIsolated(): boolean {
  return typeof globalThis !== "undefined"
    && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** Web Worker — ağır işleri ana iş parçacığından ayırmak için. */
export function hasWebWorker(): boolean {
  return typeof Worker !== "undefined";
}

export interface Capabilities {
  webgpu: boolean;
  webrtc: boolean;
  indexeddb: boolean;
  crossOriginIsolated: boolean;
  worker: boolean;
}

/** Tüm yetenekleri tek seferde (savunmacı) algılar — hata atmaz. */
export function detectCapabilities(): Capabilities {
  return {
    webgpu: hasWebGPU(),
    webrtc: hasWebRTC(),
    indexeddb: hasIndexedDB(),
    crossOriginIsolated: isCrossOriginIsolated(),
    worker: hasWebWorker(),
  };
}
