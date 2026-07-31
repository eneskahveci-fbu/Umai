import { useStore } from "./store";

/* "Akış bitene kadar bekle" kapısı — TEK kaynak.

   İki ayrı yerde aynı ihtiyaç vardı ve ikisi de ayrı ayrı yazılmıştı:
   • service worker güncellemesi (sw-register.ts): yeni sürüm tam bir yanıtın
     ortasında devralınca sayfa yenileniyor, kullanıcı "sohbetten atıldım,
     tarayıcı kendini yeniden başlattı" diyordu;
   • terminal/kod çıktısının ajana geri beslenmesi (CoderView): akışın
     ortasında `role:"user"` mesaj eklenince akan metin onun üzerine yazılıyor
     ve modelin cevabı kullanıcı balonunda görünüyordu.

   Bağımlılıklar ENJEKTE edilir: bu projenin testleri jsdom kullanmaz
   (`environment: node`), bu yüzden mantık DOM/tarayıcı olmadan saf birim
   testiyle doğrulanabilmelidir. */

export interface StreamGateOptions {
  isStreaming: () => boolean;
  subscribe: (listener: () => void) => () => void;
  run: () => void;
  /** Güvenlik ağı (ms): süre dolunca `run` YİNE DE çalıştırılır.
   *
   *  Yalnız YIKICI OLMAYAN işler için verilmeli (ör. bir bildirim göstermek).
   *  Sohbete mesaj eklemek gibi işlerde verilmemeli — akışın ortasına düşmek
   *  tam da bu kapının önlediği hatadır. */
  safetyMs?: number;
  /** Vazgeçme sınırı (ms): süre dolunca `run` ÇALIŞTIRILMADAN abonelik çözülür
   *  ve varsa `onGiveUp` çağrılır.
   *
   *  Neden gerekli: `safetyMs` verilmediğinde abonelik yalnız akış bitince
   *  çözülüyordu. `streaming` bayrağı bir hata yüzünden takılı kalırsa
   *  (setStreaming(false) bir finally'de olduğu için nadir ama mümkün)
   *  abonelik hiç çözülmüyor; art arda komut çalıştıran bir ajan turunda
   *  abonelikler sınırsız birikiyordu. */
  giveUpMs?: number;
  /** `giveUpMs` dolduğunda çağrılır — kullanıcıya durumu bildirmek için. */
  onGiveUp?: () => void;
}

/** Ajan çıktısını beklerken makul üst sınır. Bu süreyi aşan bir "akış"
    gerçekte takılmış demektir; beklemeye devam etmek yalnız abonelik
    biriktirir. */
const DEFAULT_GIVE_UP_MS = 10 * 60_000;

/** `run`'ı akış BİTTİKTEN sonra çalıştırır; akış yoksa hemen çalıştırır.
 *  `run` en fazla BİR KEZ çağrılır (dinleyici, güvenlik ağı ve vazgeçme
 *  sınırı birbiriyle yarışsa bile) ve her yolda abonelik çözülür. */
export function runAfterStreaming(opts: StreamGateOptions): void {
  const { isStreaming, subscribe, run, safetyMs, giveUpMs, onGiveUp } = opts;
  if (!isStreaming()) { run(); return; }
  let done = false;
  let unsub: (() => void) | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  /** `execute=false` → yalnız temizle (vazgeçme yolu). */
  const finish = (execute: boolean) => {
    if (done) return;
    done = true;
    unsub?.();
    for (const t of timers) clearTimeout(t);
    if (execute) run();
    else onGiveUp?.();
  };
  unsub = subscribe(() => { if (!isStreaming()) finish(true); });
  if (safetyMs !== undefined) timers.push(setTimeout(() => finish(true), safetyMs));
  if (giveUpMs !== undefined) timers.push(setTimeout(() => finish(false), giveUpMs));
}

/** Store'a bağlı kısa yol. Güvenlik ağı YOK (akışın ortasına düşmemek için),
 *  ama sızıntıyı önleyen bir vazgeçme sınırı VAR. */
export function runWhenNotStreaming(run: () => void, onGiveUp?: () => void): void {
  runAfterStreaming({
    isStreaming: () => useStore.getState().streaming,
    subscribe: (cb) => useStore.subscribe(cb),
    run,
    giveUpMs: DEFAULT_GIVE_UP_MS,
    onGiveUp,
  });
}
