import type { DesignSystem } from "./types";

/* Stüdyo tasarım sistemleri — Open Design'ın DESIGN.md üslup sözleşmelerine paralel
   (renk/tipografi/köşe/ton tarifi), Getdesign (MIT) ilhamlı. Her sistem: kısa üslup
   prozası (designMd) + CSS değişkenleri (tokensCss). Üretimde designMd sistem
   promptuna, tokensCss üretilen tasarımın <head>'ine enjekte edilir.

   BİLİNÇLİ KARAR: isimler/kategoriler/prozalar GERÇEK ŞİRKET/ÜRÜN adı TAŞIMAZ (ör.
   "Claude", "OpenAI", "Stripe" gibi). Önceden bu seçiciyi ekrana getiren denetimde
   (bu ürünün Claude'un tasarım diliyle karşılaştırıldığı bir oturumda) Anthropic'in
   kendi ürün kimliğinin (ve diğer gerçek şirketlerin) bir "tema" seçeneğine
   indirgenmesi hem ironik hem marka/güven riski olarak işaretlendi — kullanıcı
   üçüncü bir markanın görsel kimliğini taklit eden içerik ürettiğini fark etmeden
   üretebiliyordu. Aşağıdaki her giriş yalnızca RENK/TİPOGRAFİ/TON tarifidir, hiçbir
   marka adına veya tescilli yazı tipine (ör. Söhne/Circular/Gotham/Geist) atıfta
   bulunmaz — id'ler (kalıcı kullanıcı seçimlerini bozmamak için) değişmedi. */

export type { DesignSystem };

/* Kısa yardımcı: tutarlı token bloğu üret. */
function tokens(o: { brand: string; bg: string; surface: string; ink: string; muted: string; radius: string; font: string; heading?: string }): string {
  return `:root{--brand:${o.brand};--primary:${o.brand};--accent:${o.brand};--color-brand:${o.brand};--bg:${o.bg};--surface:${o.surface};--ink:${o.ink};--text:${o.ink};--muted:${o.muted};--radius:${o.radius};--font:${o.font};--font-heading:${o.heading ?? o.font}}`;
}

/* H3 — Özel web fontları: önceden `font`/`heading` yalnız bir CSS değişkeninin
   İSMİYDİ ("Inter, system-ui, sans-serif") ama hiçbir yerde gerçekten
   YÜKLENMİYORDU (Google Fonts <link> hiç enjekte edilmiyordu) — tarayıcı
   sessizce system-ui'a düşüyor, 14 "farklı" marka aynı görünüyordu. Burada
   listelenen adlar GERÇEK, açık kaynaklı (SIL OFL) Google Fonts aileleridir
   (marka/tescilli yazı tipi DEĞİL — bkz. dosya başındaki bilinçli karar notu);
   googleFontsLink() bunlardan tek bir <link> üretir, studioGen.ts üretim
   SONRASI bunu <head>'e enjekte eder (yalnız istemekle YETİNMEZ — G1'deki
   "garanti et, umma" ilkesiyle aynı). */
const GOOGLE_FONT_NAMES = new Set([
  "Fraunces", "Lora", "Space Grotesk", "Manrope", "Archivo", "Source Serif 4",
  "Poppins", "Sora", "Plus Jakarta Sans", "IBM Plex Sans", "Outfit",
  "Oswald", "Nunito", "JetBrains Mono", "Inter", "DM Sans",
]);

function firstFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function googleFontsLink(...stacks: string[]): string | undefined {
  const families = Array.from(new Set(stacks.map(firstFamily).filter((f) => GOOGLE_FONT_NAMES.has(f))));
  if (!families.length) return undefined;
  const q = families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${q}&display=swap" rel="stylesheet">`;
}

/* Tüm alanları TEK yerden kurar: tokensCss VE fontLink aynı font/heading
   girdisinden türer — iki yerde ayrı ayrı yazılıp tutarsızlaşma riski yok. */
function buildSystem(o: {
  id: string; name: string; category: string; designMd: string;
  brand: string; bg: string; surface: string; ink: string; muted: string; radius: string; font: string; heading?: string;
}): DesignSystem {
  return {
    id: o.id, name: o.name, category: o.category, accent: o.brand, designMd: o.designMd,
    tokensCss: tokens(o),
    fontLink: googleFontsLink(o.font, o.heading ?? o.font),
  };
}

export const bundledDesignSystems: DesignSystem[] = [
  buildSystem({
    id: "craft", name: "Umai", category: "Varsayılan",
    designMd: "Sıcak amber vurgu (#c8a87e) üzerine koyu, sofistike bir palet. Arka plan #111110, yüzey #181714, metin #f0ebe0, yardımcı metin #9a9080. Tipografi: şık serif başlık (Fraunces) + temiz sans gövde (Inter), dengeli ölçek. Köşeler orta-yumuşak (12px). Ton: premium, sade, güven veren. Bol nefes alanı, ince kenarlıklar (#2e2a24).",
    brand: "#c8a87e", bg: "#111110", surface: "#181714", ink: "#f0ebe0", muted: "#9a9080", radius: "12px",
    font: "'Inter', system-ui, sans-serif", heading: "'Fraunces', Georgia, serif",
  }),
  buildSystem({
    id: "claude", name: "Sıcak Kağıt", category: "Sakin",
    designMd: "Sıcak terracotta vurgu (#d97757), kremsi arka plan (#f7f4ef), koyu metin (#3d3d3a). İnsani, sakin, okunabilir. Serif başlık (Lora) + sans gövde (Inter) karışımı. Cömert satır aralığı, yumuşak köşeler (10px), düşük kontrastlı kenarlıklar. Ton: düşünceli, yardımsever, gösterişsiz.",
    brand: "#d97757", bg: "#f7f4ef", surface: "#ffffff", ink: "#3d3d3a", muted: "#73726c", radius: "10px",
    font: "'Inter', system-ui, sans-serif", heading: "'Lora', Georgia, serif",
  }),
  buildSystem({
    id: "openai", name: "Teknik Minimal", category: "Sade",
    designMd: "Yeşil vurgu (#10a37f), beyaz arka plan, neredeyse siyah metin (#0d0d0d). Aşırı temiz, minimal, bol beyaz alan. Tek aile sans-serif (Inter), net hiyerarşi. Köşeler keskin-orta (6-8px). Ton: nötr, teknik, sade. Az renk, çok boşluk.",
    brand: "#10a37f", bg: "#ffffff", surface: "#f7f7f8", ink: "#0d0d0d", muted: "#6e6e80", radius: "8px",
    font: "'Inter', system-ui, sans-serif",
  }),
  buildSystem({
    id: "linear", name: "Gece İndigo", category: "Geliştirici",
    designMd: "İndigo-mor vurgu (#5e6ad2) üzerine çok koyu arka plan (#0b0c10), yüzey #16171b. Yüksek yoğunluklu, keskin, hızlı his. Geometrik başlık (Space Grotesk) + sans gövde (Inter), sıkı satır aralığı. Köşeler hafif (8px), ince parıltılı kenarlıklar. Gradyan vurgular. Ton: modern, mühendis-odaklı, cilalı.",
    brand: "#5e6ad2", bg: "#0b0c10", surface: "#16171b", ink: "#f7f8f8", muted: "#8a8f98", radius: "8px",
    font: "'Inter', system-ui, sans-serif", heading: "'Space Grotesk', system-ui, sans-serif",
  }),
  buildSystem({
    id: "stripe", name: "Mor Gradyan", category: "Finans",
    designMd: "Canlı mor (#635bff) vurgu, beyaz arka plan, lacivert metin (#0a2540). Profesyonel, güven veren, ferah. Gradyan hero'lar (mor→mavi), açılı bölmeler. Başlıkta Manrope, gövdede Inter — net tipografik ölçek. Köşeler yumuşak (12px), zarif gölgeler. Ton: kurumsal, premium, net.",
    brand: "#635bff", bg: "#ffffff", surface: "#f6f9fc", ink: "#0a2540", muted: "#425466", radius: "12px",
    font: "'Inter', system-ui, sans-serif", heading: "'Manrope', system-ui, sans-serif",
  }),
  buildSystem({
    id: "vercel", name: "Siyah-Beyaz", category: "Geliştirici",
    designMd: "Saf siyah-beyaz, yüksek kontrast. Vurgu = siyah (#000) / beyaz. Geometrik başlık (Archivo) + sans gövde (Inter), keskin köşeler (6px). Aşırı minimal, ızgara temelli, kenarlık-odaklı. Tek renkli + nadiren gradyan. Ton: keskin, teknik, modern. Bol beyaz alan, ince ayrımlar.",
    brand: "#000000", bg: "#ffffff", surface: "#fafafa", ink: "#000000", muted: "#666666", radius: "6px",
    font: "'Inter', system-ui, sans-serif", heading: "'Archivo', system-ui, sans-serif",
  }),
  buildSystem({
    id: "notion", name: "Belge Sade", category: "Üretkenlik",
    designMd: "Nötr antrasit (#2f3437) metin, beyaz arka plan, sıcak gri yüzeyler. Belge-benzeri, sakin, okunabilir. Serif başlık (Source Serif 4) + sans gövde (Inter); cömert satır yüksekliği. Köşeler hafif (4-6px), neredeyse gölgesiz. Emoji ikon kültürü. Ton: dostça, sade, içerik-öncelikli.",
    brand: "#2f3437", bg: "#ffffff", surface: "#f7f6f3", ink: "#37352f", muted: "#9b9a97", radius: "6px",
    font: "'Inter', system-ui, sans-serif", heading: "'Source Serif 4', Georgia, serif",
  }),
  buildSystem({
    id: "slack", name: "Aubergine Enerji", category: "Üretkenlik",
    designMd: "Aubergine mor (#611f69) + canlı vurgular (yeşil/mavi/sarı). Beyaz arka plan, koyu metin. Oyunbaz ama düzenli, dostça. Yuvarlak-hatlı başlık (Poppins) + sans gövde (Inter). Renkli rozet/ikonlar. Ton: enerjik, samimi, ekip-odaklı.",
    brand: "#611f69", bg: "#ffffff", surface: "#f8f8fa", ink: "#1d1c1d", muted: "#616061", radius: "10px",
    font: "'Inter', system-ui, sans-serif", heading: "'Poppins', system-ui, sans-serif",
  }),
  buildSystem({
    id: "figma", name: "Yaratıcı Renkli", category: "Tasarım",
    designMd: "Çok-renkli vurgu (mor #a259ff, kırmızı, yeşil, mavi, turuncu). Beyaz tuval, koyu metin. Yaratıcı, canlı, araç-odaklı. Başlıkta Sora, gövdede Inter, orta köşeler (8px). Renkli geometrik şekiller. Ton: yaratıcı, modern, oyunbaz-profesyonel.",
    brand: "#a259ff", bg: "#ffffff", surface: "#f5f5f7", ink: "#1e1e1e", muted: "#7a7a7a", radius: "8px",
    font: "'Inter', system-ui, sans-serif", heading: "'Sora', system-ui, sans-serif",
  }),
  buildSystem({
    id: "spotify", name: "Gece Yeşili", category: "Medya",
    designMd: "Canlı yeşil (#1db954) üzerine siyah arka plan (#121212), koyu yüzeyler. Cesur, müzik-odaklı, enerjik. Yuvarlak-hatlı başlık (Plus Jakarta Sans), kalın. Tam yuvarlak butonlar (500px), kart-temelli. Gradyan kapaklar. Ton: genç, dinamik, premium-eğlence.",
    brand: "#1db954", bg: "#121212", surface: "#181818", ink: "#ffffff", muted: "#b3b3b3", radius: "8px",
    font: "'Inter', system-ui, sans-serif", heading: "'Plus Jakarta Sans', system-ui, sans-serif",
  }),
  buildSystem({
    id: "github", name: "Fonksiyonel Yeşil", category: "Geliştirici",
    designMd: "Yeşil aksiyon vurgusu (#2da44e), beyaz/koyu mod. Metin #1f2328, kenarlık #d0d7de. Yoğun bilgi, ızgara, fonksiyonel. Tek aile sans (IBM Plex Sans) + mono kod. Köşeler orta (6px), net kenarlıklar. Ton: pragmatik, teknik, güvenilir.",
    brand: "#2da44e", bg: "#ffffff", surface: "#f6f8fa", ink: "#1f2328", muted: "#656d76", radius: "6px",
    font: "'IBM Plex Sans', system-ui, sans-serif",
  }),
  buildSystem({
    id: "supabase", name: "Zümrüt Koyu", category: "Geliştirici",
    designMd: "Zümrüt yeşil (#3ecf8e) üzerine çok koyu arka plan (#1c1c1c), yüzey #2a2a2a. Geliştirici-dostu, temiz, teknik. Başlıkta Outfit, gövdede Inter, mono aksanlar. Köşeler orta (8px), ince yeşil parıltılar. Ton: açık kaynak, modern, erişilebilir.",
    brand: "#3ecf8e", bg: "#1c1c1c", surface: "#2a2a2a", ink: "#ededed", muted: "#a0a0a0", radius: "8px",
    font: "'Inter', system-ui, sans-serif", heading: "'Outfit', system-ui, sans-serif",
  }),
  buildSystem({
    id: "tesla", name: "Kırmızı Lüks", category: "Lüks",
    designMd: "Kırmızı vurgu (#e31937), siyah-beyaz minimalizm. Tam ekran görseller, ince tipografi. Dar/uzun başlık (Oswald) + sans gövde (Inter). Çok az renk, çok büyük boşluk. Köşeler keskin (2-4px), sade butonlar. Ton: lüks, fütüristik, az-ama-öz. Merkezi hizalı kahraman bölümler.",
    brand: "#e31937", bg: "#ffffff", surface: "#f4f4f4", ink: "#171a20", muted: "#5c5e62", radius: "4px",
    font: "'Inter', system-ui, sans-serif", heading: "'Oswald', system-ui, sans-serif",
  }),
  buildSystem({
    id: "airbnb", name: "Mercan Sıcak", category: "Seyahat",
    designMd: "Mercan-pembe vurgu (#ff385c), beyaz arka plan, koyu gri metin (#222). Sıcak, davetkâr, fotoğraf-öncelikli. Yuvarlak-hatlı tek aile (Nunito), yuvarlak köşeler (12px), yumuşak gölgeler. Büyük kart görselleri. Ton: misafirperver, insancıl, güven veren.",
    brand: "#ff385c", bg: "#ffffff", surface: "#f7f7f7", ink: "#222222", muted: "#717171", radius: "12px",
    font: "'Nunito', system-ui, sans-serif",
  }),
  buildSystem({
    id: "cursor", name: "Mavi Kod", category: "Geliştirici",
    designMd: "Mavi vurgu (#6c8eef) üzerine koyu arka plan (#0a0a0a), yüzey #141414. Minimal, kod-odaklı, keskin. Mono başlık (JetBrains Mono) + sans gövde (Inter), sıkı tipografi. Köşeler hafif (6px), ince kenarlıklar. Gradyan vurgular. Ton: hızlı, modern, mühendis-odaklı.",
    brand: "#6c8eef", bg: "#0a0a0a", surface: "#141414", ink: "#ededed", muted: "#8a8a8a", radius: "6px",
    font: "'Inter', system-ui, sans-serif", heading: "'JetBrains Mono', ui-monospace, monospace",
  }),
];

export function designSystemById(id: string | null | undefined): DesignSystem | undefined {
  if (!id) return undefined;
  return bundledDesignSystems.find((s) => s.id === id);
}

/* Üretim sistem promptu için marka sözleşmesi metni. */
export function designSystemPromptText(s: DesignSystem): string {
  const fontNote = s.fontLink
    ? " Bu markanın gerçek bir web fontu var — üretimin SONUNDA otomatik olarak <head>'e eklenecek; sen yalnız h1-h6'da var(--font-heading), gövdede var(--font) kullan, ayrıca bir font <link> EKLEMENE gerek yok."
    : "";
  return `Marka: ${s.name}\n${s.designMd}\nCSS değişkenleri mevcut (--brand, --bg, --surface, --ink, --muted, --radius, --font, --font-heading) — bunları kullan.${fontNote}`;
}
