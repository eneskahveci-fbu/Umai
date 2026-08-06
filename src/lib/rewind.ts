/* Oturum geri sarma (Claude Code'un /rewind karşılığı).

   Mevcut "Geri Al" yalnız SON turu geri alıyordu. Bu modül, sohbetin
   HERHANGİ bir noktasına dönmeyi planlar: hem konuşmayı o noktaya kısaltır
   hem de o noktadan SONRA yapılmış tüm dosya değişikliklerini geri alır.

   İNCELİKLİ NOKTA — hangi anlık görüntü geri yüklenmeli:
   Bir dosya 3., 5. ve 7. turlarda değiştiyse, 3. turdan öncesine dönmek için
   3. turun `previous`'ı gerekir (5. ve 7. turunki ARA durumlardır; onları
   yazmak dosyayı yanlış bir ara hâlde bırakır). Yani her yol için kapsamdaki
   EN ESKİ checkpoint kazanır. Bu, "en son gördüğünü yaz" gibi sezgisel bir
   uygulamanın sessizce yanlış sonuç verdiği yerdir — testlerle sabitlendi.

   `previous === null` ⇒ dosya o turda OLUŞTURULDU ⇒ geri sarmak = SİL.

   Saf fonksiyon: UI/ağ yok, tam test edilebilir. */

import type { ChatMessage } from "./types";

export interface RewindPlan {
  /** Eski içeriğiyle geri yazılacak dosyalar. */
  restore: { path: string; content: string }[];
  /** Tamamen silinecek dosyalar (geri sarılan aralıkta oluşturulmuşlar). */
  remove: string[];
  /** Konuşmanın kırpılacağı uzunluk — mesaj dizisi bu uzunluğa indirilir. */
  keepCount: number;
  /** Geri sarma kapsamındaki mesaj sayısı (kullanıcıya "N mesaj silinecek"). */
  droppedMessages: number;
}

/**
 * `targetIndex`: bu indeksteki mesaj DAHİL korunur; sonrası atılır.
 * Tipik kullanım: kullanıcı bir kullanıcı mesajına "buraya dön" derse, o
 * mesajın BİR ÖNCESİNE dönülür (yani mesajın kendisi de yeniden yazılabilsin).
 * Çağıran taraf hangi indeksi geçeceğine karar verir; burada tek kural
 * `targetIndex` dahil korunur.
 */
export function planRewind(messages: ChatMessage[], targetIndex: number): RewindPlan {
  const keepCount = Math.max(0, Math.min(targetIndex + 1, messages.length));
  const dropped = messages.slice(keepCount);

  /* Yol → geri yüklenecek anlık görüntü. Kapsamı ESKİDEN YENİYE gez ve yalnız
     İLK görüleni tut → her dosya için en eski hâl kazanır (bkz. başlık notu). */
  const snapshot = new Map<string, string | null>();
  for (const m of dropped) {
    for (const cp of m.checkpoints ?? []) {
      if (!snapshot.has(cp.path)) snapshot.set(cp.path, cp.previous);
    }
  }

  const restore: { path: string; content: string }[] = [];
  const remove: string[] = [];
  for (const [path, previous] of snapshot) {
    if (previous === null) remove.push(path);
    else restore.push({ path, content: previous });
  }
  /* Kararlı sıra — testler ve kullanıcıya gösterilen liste tutarlı olsun. */
  restore.sort((a, b) => a.path.localeCompare(b.path));
  remove.sort((a, b) => a.localeCompare(b));

  return { restore, remove, keepCount, droppedMessages: dropped.length };
}

/** Geri sarmanın dosya tarafında yapacağı bir iş var mı? */
export function planTouchesFiles(plan: RewindPlan): boolean {
  return plan.restore.length > 0 || plan.remove.length > 0;
}
