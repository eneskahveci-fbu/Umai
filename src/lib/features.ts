/* Özellik anahtarları — "rafa kaldırılan" özellikler (Eyl 2026 kullanıcı kararı).
   Kapalı bir özellik arayüzden, menülerden, ⌘K'dan ve rotalardan GİZLENİR ama
   kodu repoda durur; geri açmak için burada `true` yapmak yeterli. Kullanıcı
   verisi (config.craftDocs, studioProjects, mediaAssets…) silinmez.
   `/a/[id]` yayınlanmış artifact bağlantıları bilinçli olarak etkilenmez —
   daha önce paylaşılmış linkler çalışmaya devam eder. */

export interface Features {
  /** Tasarım Stüdyosu (/studio, /studio/sunum, /studio/tuval) + sohbetten "Stüdyo'da aç". */
  designStudio: boolean;
  /** İçerik araçları: Doküman/Anket/Defter/Kroki/Kartlar (/studio/araclar ve eski yolları). */
  contentTools: boolean;
  /** Görsel üretimi (/gorsel, generate_image aracı) + yanıt seslendirme (TTS). */
  media: boolean;
}

export const FEATURES: Features = {
  designStudio: false,
  contentTools: false,
  media: false,
};

/** En az bir Stüdyo yüzeyi açık mı (Sidebar/mobil "Stüdyo" girişi için). */
export function studioEnabled(f: Features = FEATURES): boolean {
  return f.designStudio || f.contentTools;
}

const CONTENT_TOOL_SEGMENTS = new Set(["araclar", "anket", "defter", "dokuman", "kartlar", "kroki"]);

/** /studio altındaki bir yol şu anki anahtarlarla açılabilir mi. */
export function isStudioPathEnabled(pathname: string, f: Features = FEATURES): boolean {
  const seg = pathname.replace(/^\/studio\/?/, "").split(/[/?#]/)[0];
  if (CONTENT_TOOL_SEGMENTS.has(seg)) return f.contentTools;
  return f.designStudio;
}
