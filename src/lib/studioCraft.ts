/* Craft kural katmanı (Open Design'ın `craft/` fikrinin adaptasyonu):
   marka-BAĞIMSIZ zanaat kuralları — tipografi, renk disiplini, anti-AI-klişe,
   erişilebilirlik. Prompt'a marka sözleşmesinden SONRA eklenir; çakışmada
   marka kazanır. + lintArtifact: üretilen HTML'de kalite kontrolleri. */

export const CRAFT_RULES =
  "\n\n[ZANAAT KURALLARI — YALNIZCA görsel/HTML çıktı üretiyorsan uygula (kod/doküman/diyagram üretiyorsan YOK SAY); marka sözleşmesiyle çakışırsa MARKA kazanır]:\n" +
  "• Tipografi: en fazla 2 yazı ailesi; net ölçek (ör. 14/16/20/28/40+); satır aralığı gövdede 1.6-1.8, başlıkta 1.1-1.3; satır uzunluğu ~60-75 karakter.\n" +
  "• Renk: renkleri CSS değişkenleriyle (:root'ta --bg --surface --fg --muted --accent…) tanımla, gövdede ham hex tekrarı yapma; 1 vurgu rengi yeter.\n" +
  "• Anti-klişe: varsayılan indigo/mor SaaS paletinden (#6366f1 ailesi) kaçın; jenerik 'emoji + gradient kutu' ızgaraları yerine içeriğe özgü kompozisyon kur; sahte 'lorem ipsum' asla.\n" +
  "• Boşluk: 4/8px ritmi; bölümler arası nefes (min 64px masaüstü); kenar boşlukları tutarlı.\n" +
  "• Erişilebilirlik: metin kontrastı ≥ 4.5:1; odak durumları görünür; anlamlı alt metinleri; dokunma hedefleri ≥ 44px.\n" +
  "• Duyarlılık: <meta name=\"viewport\"> zorunlu; 360px'te taşma yok; tablolar/geniş bloklar kendi içinde kaydırılır.";

/* Kategori bazlı mükemmellik bilgisi (Tem 2026 kullanıcı kararı — "görünmez
   süpervizör" istekleriyle aynı ruhta): kategori lideri araçlardan (Gamma,
   Google AI Studio, LibreOffice/Word, modern SaaS landing sayfaları, Linear/
   Notion tarzı bileşen tasarımı) damıtılmış, KULLANICIYA HİÇ GÖSTERİLMEYEN
   somut kalite ilkeleri — yalnızca sistem promptuna eklenir. STUDIO_SKILLS'in
   `category` alanına göre seçilir (bkz. buildStudioSystem). Bu bir marka
   sözleşmesi DEĞİL (designSystems.ts o işi görür) — türe özgü KOMPOZİSYON/
   YAPI disiplinidir, herhangi bir markayla birlikte çalışır. */
export const CATEGORY_CRAFT: Record<string, string> = {
  "İçerik":
    "\n\n[SUNUM/İÇERİK MÜKEMMELLİĞİ — Gamma/Google Slides kalitesinde, görünmez referans]:\n" +
    "• Her slayt/bölümde TEK net odak fikri olsun; metni YIĞMA (slayt başına ~40 kelime, madde başına tek satır).\n" +
    "• Büyük tipografi + bol nefes alanı; başlık ile destekleyici görsel/ikon arasında görsel denge kur.\n" +
    "• Renk/tipografi sistemini TÜM slaytlar/bölümler boyunca birebir tutarlı sürdür (aynı vurgu, aynı ölçek).\n" +
    "• Anlatı akışı kur: kapak → bağlam → kanıt/detay → kapanış/çağrı-eylem — rastgele sıralı bilgi yığını değil.",
  "Uygulama":
    "\n\n[ARAÇ/UYGULAMA ARAYÜZÜ MÜKEMMELLİĞİ — Google AI Studio/Linear kalitesinde, görünmez referans]:\n" +
    "• Özeti ÖNCE, detayı SONRA göster: üstte durum/metrik özeti (kart/rozet), altta detay.\n" +
    "• Etkileşimli her öğe görsel olarak da etkileşimli görünsün (hover/aktif/odak durumları belirgin).\n" +
    "• Boş/yükleniyor/hata durumlarını da tasarla — yalnız 'dolu' hal değil.\n" +
    "• Yoğun bilgiyi net gruplarla (kart/tablo/bölüm başlığı) organize et; ham liste yığma.",
  "Akademik":
    "\n\n[DOKÜMAN/BELGE MÜKEMMELLİĞİ — LibreOffice/Word kalitesinde, görünmez referans]:\n" +
    "• Net başlık hiyerarşisi (H1>H2>H3 tutarlı ölçek ve boşluk); paragraf/satır aralığı baştan sona tutarlı.\n" +
    "• Yazdırmaya uygun kenar boşlukları ve sayfa/bölüm ayrımı belirgin olsun.\n" +
    "• Tablo/şekil varsa numaralandır ve kısa başlık ekle; kaynakça/referans varsa hizalı ve okunur olsun.",
  "Web":
    "\n\n[WEB SAYFASI MÜKEMMELLİĞİ — en iyi SaaS landing sayfaları kalitesinde, görünmez referans]:\n" +
    "• Net bir CTA hiyerarşisi kur: TEK birincil eylem (dolu buton) + ikincil eylemler (outline/metin).\n" +
    "• Bölümler arası kaydırma ritmini kır: arka plan/kontrast değişimiyle bölüm sınırlarını belirginleştir.\n" +
    "• Somut, gerçekçi mikro-kopya yaz ('Özellik 1' değil, gerçek bir fayda cümlesi).",
  "Bileşen":
    "\n\n[BİLEŞEN MÜKEMMELLİĞİ — Linear/Notion kalitesinde, görünmez referans]:\n" +
    "• Bileşenin TÜM durumlarını göster (boş/yükleniyor/hata/dolu) — yalnız ideal durumu değil.\n" +
    "• Etkileşim geri bildirimi (hover/focus/active) belirgin ve tutarlı olsun.\n" +
    "• Boşluk ve hizalama piksel-hassas olsun; komşu öğeler arası ritim tekrar etsin.",
};

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
