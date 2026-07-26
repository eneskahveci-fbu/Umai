/* Akıcı yazma + akış performansı (R2 / S1).

   Sorun: SSE döngüsü her token'da `updateLastContent(full)` çağırıyordu. Her
   çağrı Zustand'ı günceller, MessageBubble'ı yeniden çizer ve ReactMarkdown
   mesajın TAMAMINI baştan ayrıştırır. 5.000 karakterlik bir yanıt ~1.000
   token demek → ~1.000 tam markdown ayrıştırması; cevap uzadıkça yazma
   görünür şekilde ağırlaşıyordu. Görsel olarak da kötüydü: metin token
   sınırlarında blok blok "zıplayarak" beliriyordu.

   Çözüm: token'lar bir tampona yazılır, çizim requestAnimationFrame ile kare
   hızına bağlanır. Böylece güncelleme sayısı saniyede ~60 ile sınırlanır
   (yavaşlamanın büyük kısmı gider) ve metin kare kare, sabit hızda akar
   (aradığımız "akıcı yazma" hissi).

   ÖNEMLİ: bu bir yavaşlatıcı DEĞİL. Adım boyu kalan yazıya göre ölçeklendiği
   için model hızlı yazdığında hızlı, yavaş yazdığında yavaş akar; tampon asla
   büyümez. Yalnızca çizim kare sınırlarına hizalanır.

   Saf çekirdek (revealStep) ayrı tutuldu → birim testli. */

/** Kare başına en az bu kadar karakter açılır — çok yavaş akışta bile ilerler. */
export const MIN_CHARS_PER_FRAME = 2;

/** Kalan yazının kaçta biri her karede açılır. Küçük değer = daha hızlı
    yetişme. 6, 60fps'te gecikmeyi ~100 ms altında tutar. */
export const CATCH_UP_DIVISOR = 6;

/** Bu kadar geride kalındıysa animasyonu bırak, doğrudan sona atla. Sekme
    arka plandayken rAF durur; geri dönüldüğünde binlerce karakteri tek tek
    açmaya çalışmak anlamsız bir gecikme olurdu. */
export const MAX_PENDING_BEFORE_JUMP = 4000;

/** Bir sonraki karede kaç karakterin görünür olacağını hesaplar. */
export function revealStep(shown: number, target: number): number {
  const pending = target - shown;
  if (pending <= 0) return target;
  if (pending > MAX_PENDING_BEFORE_JUMP) return target;
  return Math.min(target, shown + Math.max(MIN_CHARS_PER_FRAME, Math.ceil(pending / CATCH_UP_DIVISOR)));
}

export interface RevealController {
  /** Akıştan gelen YENİ tam metin (biriktirilmiş `full`). */
  push(fullText: string): void;
  /** Akış bitti — kalan metni tek seferde göster ve döngüyü durdur. */
  finish(): void;
  /** İptal (abort/unmount) — bekleyen kareyi bırak, çizim yapma. */
  cancel(): void;
}

interface RevealOptions {
  /** Test edilebilirlik için enjekte edilir; verilmezse tarayıcının rAF'ı. */
  raf?: (cb: () => void) => number;
  cancelRaf?: (handle: number) => void;
}

/**
 * Akış metnini kare hızına bağlı olarak açan denetleyici.
 *
 * `onFrame` yalnızca görünen metin GERÇEKTEN değiştiğinde çağrılır — aynı
 * içerikle gereksiz store güncellemesi/yeniden çizim yapılmaz.
 */
export function createReveal(
  onFrame: (visibleText: string) => void,
  opts: RevealOptions = {},
): RevealController {
  const raf = opts.raf
    ?? (typeof requestAnimationFrame === "function"
      ? (cb: () => void) => requestAnimationFrame(cb)
      : undefined);
  const cancelRaf = opts.cancelRaf
    ?? (typeof cancelAnimationFrame === "function"
      ? (h: number) => cancelAnimationFrame(h)
      : undefined);

  let target = "";
  let shown = 0;
  let handle: number | null = null;
  let stopped = false;

  /* rAF yoksa (SSR / test ortamı / çok eski tarayıcı) animasyonsuz, doğrudan
     yazan bir denetleyiciye düş — davranış eskisiyle aynı kalır, kırılmaz. */
  if (!raf) {
    return {
      push(fullText) { if (!stopped) onFrame(fullText); },
      finish() { stopped = true; },
      cancel() { stopped = true; },
    };
  }

  const tick = () => {
    handle = null;
    if (stopped) return;
    const next = revealStep(shown, target.length);
    if (next !== shown) {
      shown = next;
      onFrame(target.slice(0, shown));
    }
    if (shown < target.length) schedule();
  };

  const schedule = () => {
    if (handle === null && !stopped) handle = raf(tick);
  };

  return {
    push(fullText) {
      if (stopped) return;
      target = fullText;
      schedule();
    },
    finish() {
      if (stopped) return;
      stopped = true;
      if (handle !== null && cancelRaf) { cancelRaf(handle); handle = null; }
      /* Kalan metin varsa son hâli tek seferde yaz — akış bitmişken kullanıcıyı
         animasyonun geri kalanı için bekletmenin anlamı yok. */
      if (shown < target.length) { shown = target.length; onFrame(target); }
    },
    cancel() {
      stopped = true;
      if (handle !== null && cancelRaf) { cancelRaf(handle); handle = null; }
    },
  };
}
