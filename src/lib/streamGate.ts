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
  /** Güvenlik ağı (ms). Verilmezse zamanlayıcı KURULMAZ — akış bitene kadar
   *  süresiz beklenir.
   *
   *  Neden varsayılan yok: `streaming` bayrağı bir hatadan ötürü takılı
   *  kalırsa bir bildirimi yine de göstermek zararsızdır, ama sohbete mesaj
   *  eklemek/sayfayı yenilemek tam da düzeltmeye çalıştığımız hatayı geri
   *  getirir. Bu yüzden karar çağırana bırakıldı. */
  safetyMs?: number;
}

/** `run`'ı akış BİTTİKTEN sonra çalıştırır; akış yoksa hemen çalıştırır.
 *  `run` en fazla BİR KEZ çağrılır (dinleyici ile güvenlik ağı yarışsa bile). */
export function runAfterStreaming(opts: StreamGateOptions): void {
  const { isStreaming, subscribe, run, safetyMs } = opts;
  if (!isStreaming()) { run(); return; }
  let done = false;
  let unsub: (() => void) | null = null;
  let safety: ReturnType<typeof setTimeout> | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    unsub?.();
    if (safety) clearTimeout(safety);
    run();
  };
  unsub = subscribe(() => { if (!isStreaming()) finish(); });
  if (safetyMs !== undefined) safety = setTimeout(finish, safetyMs);
}

/** Store'a bağlı kısa yol — güvenlik ağı YOK (bkz. `safetyMs` notu). */
export function runWhenNotStreaming(run: () => void, safetyMs?: number): void {
  runAfterStreaming({
    isStreaming: () => useStore.getState().streaming,
    subscribe: (cb) => useStore.subscribe(cb),
    run,
    safetyMs,
  });
}
