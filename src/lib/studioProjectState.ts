/* Stüdyo proje durumu — kaydedilmemiş iş tespiti (U2/U3).

   Sorun: DesignStudio'daki "+ Yeni" düğmesi newDesignProject() ile mevcut
   projeyi DOĞRUDAN siliyordu (bkz. newProjectAction) — kullanıcı bir tasarım
   üretip kaydetmeyi unuttuysa tek tıkla kaybediyordu. Ayrıca giriş ekranına
   (galeriye) dönüşün BAŞKA bir yolu yoktu: ya projeyi yok edecektin ya da
   stüdyoyu tamamen kapatacaktın.

   Bu modül "bu projede kaybedilecek bir şey var mı?" sorusunu saf ve test
   edilebilir biçimde cevaplar; UI hem onay sormak (U3) hem de galeriye
   dönerken otomatik kaydetmek (U2) için aynı yanıtı kullanır. */

export interface SavedLike {
  id: string;
  updatedAt?: number;
}

/* Zaman damgasından BAĞIMSIZ içerik imzası.

   Neden gerekli: `hasUnsavedItem` eskiden yalnız `updatedAt` karşılaştırıyordu,
   ama HİÇBİR yüzey düzenleme sırasında bu damgayı vurmuyor — damga yalnız
   KAYDETME anında vuruluyor (bkz. DocsStudio `patchDoc`, MapStudio `patchRoot`,
   CardsStudio `patchCard`, FormsStudio `patchForm`). Sonuç: KAYITLI bir öğeyi
   açıp baştan sona değiştirdikten sonra "+ Yeni"ye basınca iki damga eşit
   kalıyor, uyarı çıkmıyor ve tüm düzenleme sessizce siliniyordu — modülün tam
   da önlemek için yazıldığı kayıp.

   Neden damgayı düzenlemede vurmuyoruz: render gövdesinde `Date.now()`
   çağırmak saf olmayan bir işlem (eslint react-hooks/purity) — NotebookStudio
   bu duvara çarpıp aynı çözüme (içerik imzası) geçmişti, bkz. nbSignature.
   Ayrıca damgayı mutasyon noktalarına serpmek yalnız CardsStudio'da 9 ayrı
   `setDeck` çağrısı demek; biri unutulduğunda hata sessizce geri gelir.

   JSON semantiği kasıtlı: anahtarlar özyinelemeli sıralanır ve `undefined`
   değerler düşer — çünkü karşılaştırılan kopya localStorage'dan JSON olarak
   geri okunuyor. Örn. FormsStudio `required: e.target.checked || undefined`
   yazıyor: oturum içinde anahtar VAR (değeri undefined), yeniden yüklemeden
   sonra anahtar YOK. Naif bir derin karşılaştırma bunu fark sanıp her
   "+ Yeni"de boş yere onay sorardı. */
const SIGNATURE_IGNORED_KEYS = ["updatedAt", "createdAt"];

export function contentSignature(value: unknown, ignore: readonly string[] = SIGNATURE_IGNORED_KEYS): string {
  const walk = (v: unknown, top: boolean): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, false));
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      if (top && ignore.includes(key)) continue;
      const child = src[key];
      if (child === undefined) continue; // JSON round-trip ile aynı davran
      out[key] = walk(child, false);
    }
    return out;
  };
  return JSON.stringify(walk(value, true)) ?? "";
}

export interface ProjectLike {
  id: string;
  /** Üretilmiş çıktı — boşsa ortada henüz bir iş yok. */
  html?: string;
  updatedAt?: number;
}

/**
 * Projede kaydedilmemiş bir değişiklik var mı?
 *
 * • Hiç çıktı üretilmediyse (html boş) kaybedilecek bir şey yoktur.
 * • Kayıtlılar arasında bu id yoksa hiç kaydedilmemiş demektir.
 * • Kayıtlı kopya varsa: içeriği farklıysa YA DA updatedAt'i daha yeniyse,
 *   kaydedildikten SONRA değişmiş demektir (bkz. contentSignature).
 */
export function hasUnsavedWork(project: ProjectLike, saved: readonly ProjectLike[]): boolean {
  /* Tasarım stüdyosunda "iş var mı" ölçütü üretilmiş çıktıdır (html). */
  if (!project.html) return false;
  return hasUnsavedItem(project, saved);
}

/**
 * Aynı kural, çıktı-tipi bağımsız hâli (X2).
 *
 * Doküman/Anket/Defter/Kroki/Kartlar yüzeylerinde "iş" bir html dizesi değil,
 * doğrudan öğenin kendisidir (null = ortada bir şey yok). Beş yüzeyin de
 * "+ Yeni" düğmesi kaydedilmemiş öğeyi onaysız siliyordu (ör. DocsStudio
 * `setDoc(null)`) — hepsi artık bu tek kurala bakıyor.
 */
export function hasUnsavedItem(
  current: SavedLike | null | undefined,
  saved: readonly SavedLike[],
): boolean {
  if (!current) return false;
  const copy = saved.find((p) => p.id === current.id);
  if (!copy) return true;
  /* VEYA-hibrit: içerik farkı YA DA daha yeni damga. Damga kuralı korunuyor
     çünkü bazı çağıranlar (ve mevcut testler) yalnız {id, updatedAt} taşıyan
     çıplak nesneler veriyor — onlarda içerik imzası eşit çıkar. İki kuralın
     birleşimi her zaman daha TEMKİNLİ: daha çok onay = daha az kayıp. */
  if ((current.updatedAt ?? 0) > (copy.updatedAt ?? 0)) return true;
  /* Ucuz ön eleme: Tasarım projesi `html` + `versions[]` taşır (MB'larca
     olabilir); değişmişse imzaya hiç gerek yok. */
  const a = current as { html?: string };
  const b = copy as { html?: string };
  if (a.html !== b.html) return true;
  return contentSignature(current) !== contentSignature(copy);
}

/** Kaydedilmiş projeleri en son güncellenen başta olacak şekilde sıralayıp
    ilk `limit` tanesini verir — ana ekrandaki "Son projeler" şeridi için (V1). */
export function recentProjects<T extends SavedLike>(saved: readonly T[], limit = 6): T[] {
  return [...saved]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, Math.max(0, limit));
}

/** "3 dk önce" gibi kısa göreli zaman. `now` DIŞARIDAN verilir: render
    sırasında Date.now() çağırmak saf olmayan bir işlem (React kuralı) ve
    testte de sabitlenemezdi. */
export function relativeTime(ts: number, now: number): string {
  const mins = Math.round((now - ts) / 60_000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.round(hrs / 24)} gün önce`;
}
