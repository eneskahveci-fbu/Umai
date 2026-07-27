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
 * • Kayıtlı kopya varsa ama projenin updatedAt'i daha yeniyse, kaydedildikten
 *   SONRA değişmiş demektir.
 */
export function hasUnsavedWork(project: ProjectLike, saved: readonly SavedLike[]): boolean {
  if (!project.html) return false;
  const copy = saved.find((p) => p.id === project.id);
  if (!copy) return true;
  return (project.updatedAt ?? 0) > (copy.updatedAt ?? 0);
}

/** Kaydedilmiş projeleri en son güncellenen başta olacak şekilde sıralayıp
    ilk `limit` tanesini verir — ana ekrandaki "Son projeler" şeridi için (V1). */
export function recentProjects<T extends SavedLike>(saved: readonly T[], limit = 6): T[] {
  return [...saved]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, Math.max(0, limit));
}
