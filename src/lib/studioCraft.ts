/* Craft kural katmanı (Open Design'ın `craft/` fikrinin adaptasyonu):
   marka-BAĞIMSIZ zanaat kuralları — tipografi, renk disiplini, anti-AI-klişe,
   erişilebilirlik. Prompt'a marka sözleşmesinden SONRA eklenir; çakışmada
   marka kazanır. + lintArtifact: üretilen HTML'de kalite kontrolleri. */

export const CRAFT_RULES =
  "\n\n[ZANAAT KURALLARI — marka sözleşmesiyle çakışırsa MARKA kazanır]:\n" +
  "• Tipografi: en fazla 2 yazı ailesi; net ölçek (ör. 14/16/20/28/40+); satır aralığı gövdede 1.6-1.8, başlıkta 1.1-1.3; satır uzunluğu ~60-75 karakter.\n" +
  "• Renk: renkleri CSS değişkenleriyle (:root'ta --bg --surface --fg --muted --accent…) tanımla, gövdede ham hex tekrarı yapma; 1 vurgu rengi yeter.\n" +
  "• Anti-klişe: varsayılan indigo/mor SaaS paletinden (#6366f1 ailesi) kaçın; jenerik 'emoji + gradient kutu' ızgaraları yerine içeriğe özgü kompozisyon kur; sahte 'lorem ipsum' asla.\n" +
  "• Boşluk: 4/8px ritmi; bölümler arası nefes (min 64px masaüstü); kenar boşlukları tutarlı.\n" +
  "• Erişilebilirlik: metin kontrastı ≥ 4.5:1; odak durumları görünür; anlamlı alt metinleri; dokunma hedefleri ≥ 44px.\n" +
  "• Duyarlılık: <meta name=\"viewport\"> zorunlu; 360px'te taşma yok; tablolar/geniş bloklar kendi içinde kaydırılır.";

/* Üretilen artifact'ta hızlı kalite denetimi — bulgu listesi döner (boş = temiz).
   Saf fonksiyon → birim testli. */
export function lintArtifact(html: string): string[] {
  const warnings: string[] = [];
  const h = html || "";
  const hexes = h.match(/#[0-9a-f]{6}\b/gi) ?? [];
  const unique = new Set(hexes.map((x) => x.toLowerCase()));
  if (unique.size > 16) warnings.push(`${unique.size} farklı ham renk — palet CSS değişkenlerine toplanmalı`);
  if (/#(6366f1|4f46e5|818cf8|7c3aed)\b/i.test(h)) warnings.push("AI-klişesi indigo/mor paleti kullanılmış");
  if (/lorem ipsum/i.test(h)) warnings.push("Lorem ipsum kalmış — gerçek içerik bekleniyordu");
  if (h.includes("<html") && !/meta[^>]+viewport/i.test(h)) warnings.push("viewport meta eksik (mobil ölçekleme bozulur)");
  return warnings;
}
