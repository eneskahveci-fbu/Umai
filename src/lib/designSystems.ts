import type { Config, DesignSystem } from "./types";

/* Stüdyo tasarım sistemleri — Open Design'ın DESIGN.md marka sözleşmelerine paralel.
   Her sistem: kısa marka prozası (designMd) + CSS değişkenleri (tokensCss). Üretimde
   designMd sistem promptuna, tokensCss üretilen tasarımın <head>'ine enjekte edilir.

   Küratörlü set — yenisini eklemek için diziye bir nesne eklemek yeterli ("klasör
   atınca görünür" mantığı). Atıf: marka sistemleri getdesign (MIT) ilhamlıdır; bu
   prozalar özgün, kısa özetlerdir (logo/marka varlığı içermez). Bkz. NOTICE. */

export type { DesignSystem };

/* Kısa yardımcı: tutarlı token bloğu üret. */
function tokens(o: { brand: string; bg: string; surface: string; ink: string; muted: string; radius: string; font: string; heading?: string }): string {
  return `:root{--brand:${o.brand};--primary:${o.brand};--accent:${o.brand};--color-brand:${o.brand};--bg:${o.bg};--surface:${o.surface};--ink:${o.ink};--text:${o.ink};--muted:${o.muted};--radius:${o.radius};--font:${o.font};--font-heading:${o.heading ?? o.font}}`;
}

export const bundledDesignSystems: DesignSystem[] = [
  {
    id: "craft", name: "Craft (Varsayılan)", category: "Craft", accent: "#c8a87e",
    designMd: "Sıcak amber vurgu (#c8a87e) üzerine koyu, sofistike bir palet. Arka plan #111110, yüzey #181714, metin #f0ebe0, yardımcı metin #9a9080. Tipografi: temiz sans-serif, dengeli ölçek. Köşeler orta-yumuşak (12px). Ton: premium, sade, güven veren. Bol nefes alanı, ince kenarlıklar (#2e2a24).",
    tokensCss: tokens({ brand: "#c8a87e", bg: "#111110", surface: "#181714", ink: "#f0ebe0", muted: "#9a9080", radius: "12px", font: "system-ui, -apple-system, sans-serif" }),
  },
  {
    id: "claude", name: "Claude", category: "AI", accent: "#d97757",
    designMd: "Sıcak terracotta vurgu (#d97757), kremsi arka plan (#f7f4ef), koyu metin (#3d3d3a). İnsani, sakin, okunabilir. Serif başlık + sans gövde karışımı tercih edilir. Cömert satır aralığı, yumuşak köşeler (10px), düşük kontrastlı kenarlıklar. Ton: düşünceli, yardımsever, gösterişsiz.",
    tokensCss: tokens({ brand: "#d97757", bg: "#f7f4ef", surface: "#ffffff", ink: "#3d3d3a", muted: "#73726c", radius: "10px", font: "'Styrene', system-ui, sans-serif", heading: "'Tiempos', Georgia, serif" }),
  },
  {
    id: "openai", name: "OpenAI", category: "AI", accent: "#10a37f",
    designMd: "Yeşil vurgu (#10a37f), beyaz arka plan, neredeyse siyah metin (#0d0d0d). Aşırı temiz, minimal, bol beyaz alan. Sans-serif (Söhne/Inter benzeri), net hiyerarşi. Köşeler keskin-orta (6-8px). Ton: nötr, teknik, sade. Az renk, çok boşluk.",
    tokensCss: tokens({ brand: "#10a37f", bg: "#ffffff", surface: "#f7f7f8", ink: "#0d0d0d", muted: "#6e6e80", radius: "8px", font: "'Söhne', Inter, system-ui, sans-serif" }),
  },
  {
    id: "linear", name: "Linear", category: "Geliştirici", accent: "#5e6ad2",
    designMd: "İndigo-mor vurgu (#5e6ad2) üzerine çok koyu arka plan (#0b0c10), yüzey #16171b. Yüksek yoğunluklu, keskin, hızlı his. İnce sans-serif (Inter), sıkı satır aralığı. Köşeler hafif (8px), ince parıltılı kenarlıklar. Gradyan vurgular. Ton: modern, mühendis-odaklı, cilalı.",
    tokensCss: tokens({ brand: "#5e6ad2", bg: "#0b0c10", surface: "#16171b", ink: "#f7f8f8", muted: "#8a8f98", radius: "8px", font: "Inter, system-ui, sans-serif" }),
  },
  {
    id: "stripe", name: "Stripe", category: "Finans", accent: "#635bff",
    designMd: "Canlı mor (#635bff) vurgu, beyaz arka plan, lacivert metin (#0a2540). Profesyonel, güven veren, ferah. Gradyan hero'lar (mor→mavi), açılı bölmeler. Sans-serif (Söhne/Inter), net tipografik ölçek. Köşeler yumuşak (12px), zarif gölgeler. Ton: kurumsal, premium, net.",
    tokensCss: tokens({ brand: "#635bff", bg: "#ffffff", surface: "#f6f9fc", ink: "#0a2540", muted: "#425466", radius: "12px", font: "'Söhne', Inter, system-ui, sans-serif" }),
  },
  {
    id: "vercel", name: "Vercel", category: "Geliştirici", accent: "#000000",
    designMd: "Saf siyah-beyaz, yüksek kontrast. Vurgu = siyah (#000) / beyaz. Geometric sans (Geist/Inter), keskin köşeler (6px). Aşırı minimal, ızgara temelli, kenarlık-odaklı. Tek renkli + nadiren gradyan. Ton: keskin, teknik, modern. Bol beyaz alan, ince ayrımlar.",
    tokensCss: tokens({ brand: "#000000", bg: "#ffffff", surface: "#fafafa", ink: "#000000", muted: "#666666", radius: "6px", font: "'Geist', Inter, system-ui, sans-serif" }),
  },
  {
    id: "notion", name: "Notion", category: "Üretkenlik", accent: "#2f3437",
    designMd: "Nötr antrasit (#2f3437) metin, beyaz arka plan, sıcak gri yüzeyler. Belge-benzeri, sakin, okunabilir. Serif/sans karışımı; cömert satır yüksekliği. Köşeler hafif (4-6px), neredeyse gölgesiz. Emoji ikon kültürü. Ton: dostça, sade, içerik-öncelikli.",
    tokensCss: tokens({ brand: "#2f3437", bg: "#ffffff", surface: "#f7f6f3", ink: "#37352f", muted: "#9b9a97", radius: "6px", font: "ui-sans-serif, -apple-system, 'Segoe UI', sans-serif" }),
  },
  {
    id: "slack", name: "Slack", category: "Üretkenlik", accent: "#611f69",
    designMd: "Aubergine mor (#611f69) + canlı vurgular (yeşil/mavi/sarı). Beyaz arka plan, koyu metin. Oyunbaz ama düzenli, dostça. Yuvarlak köşeler (10px), Lato/sans-serif. Renkli rozet/ikonlar. Ton: enerjik, samimi, ekip-odaklı.",
    tokensCss: tokens({ brand: "#611f69", bg: "#ffffff", surface: "#f8f8fa", ink: "#1d1c1d", muted: "#616061", radius: "10px", font: "Lato, system-ui, sans-serif" }),
  },
  {
    id: "figma", name: "Figma", category: "Tasarım", accent: "#a259ff",
    designMd: "Çok-renkli vurgu (mor #a259ff, kırmızı, yeşil, mavi, turuncu). Beyaz tuval, koyu metin. Yaratıcı, canlı, araç-odaklı. Sans-serif (Inter), orta köşeler (8px). Renkli geometrik şekiller. Ton: yaratıcı, modern, oyunbaz-profesyonel.",
    tokensCss: tokens({ brand: "#a259ff", bg: "#ffffff", surface: "#f5f5f7", ink: "#1e1e1e", muted: "#7a7a7a", radius: "8px", font: "Inter, system-ui, sans-serif" }),
  },
  {
    id: "spotify", name: "Spotify", category: "Medya", accent: "#1db954",
    designMd: "İmza yeşil (#1db954) üzerine siyah arka plan (#121212), koyu yüzeyler. Cesur, müzik-odaklı, enerjik. Circular/sans-serif, kalın başlıklar. Tam yuvarlak butonlar (500px), kart-temelli. Gradyan kapaklar. Ton: genç, dinamik, premium-eğlence.",
    tokensCss: tokens({ brand: "#1db954", bg: "#121212", surface: "#181818", ink: "#ffffff", muted: "#b3b3b3", radius: "8px", font: "'Circular', Montserrat, system-ui, sans-serif" }),
  },
  {
    id: "github", name: "GitHub", category: "Geliştirici", accent: "#2da44e",
    designMd: "Yeşil aksiyon vurgusu (#2da44e), beyaz/koyu mod. Metin #1f2328, kenarlık #d0d7de. Yoğun bilgi, ızgara, fonksiyonel. Sistem sans + mono kod. Köşeler orta (6px), net kenarlıklar. Ton: pragmatik, teknik, güvenilir.",
    tokensCss: tokens({ brand: "#2da44e", bg: "#ffffff", surface: "#f6f8fa", ink: "#1f2328", muted: "#656d76", radius: "6px", font: "-apple-system, 'Segoe UI', system-ui, sans-serif" }),
  },
  {
    id: "supabase", name: "Supabase", category: "Geliştirici", accent: "#3ecf8e",
    designMd: "Emerald yeşil (#3ecf8e) üzerine çok koyu arka plan (#1c1c1c), yüzey #2a2a2a. Geliştirici-dostu, temiz, teknik. Sans-serif (Circular/Inter), mono aksanlar. Köşeler orta (8px), ince yeşil parıltılar. Ton: açık kaynak, modern, erişilebilir.",
    tokensCss: tokens({ brand: "#3ecf8e", bg: "#1c1c1c", surface: "#2a2a2a", ink: "#ededed", muted: "#a0a0a0", radius: "8px", font: "'Circular', Inter, system-ui, sans-serif" }),
  },
  {
    id: "tesla", name: "Tesla", category: "Otomotiv", accent: "#e31937",
    designMd: "Kırmızı vurgu (#e31937), siyah-beyaz minimalizm. Tam ekran görseller, ince tipografi (Gotham/sans). Çok az renk, çok büyük boşluk. Köşeler keskin (2-4px), sade butonlar. Ton: lüks, fütüristik, az-ama-öz. Merkezi hizalı kahraman bölümler.",
    tokensCss: tokens({ brand: "#e31937", bg: "#ffffff", surface: "#f4f4f4", ink: "#171a20", muted: "#5c5e62", radius: "4px", font: "'Gotham', 'Helvetica Neue', system-ui, sans-serif" }),
  },
  {
    id: "airbnb", name: "Airbnb", category: "Seyahat", accent: "#ff385c",
    designMd: "Mercan-pembe vurgu (#ff385c), beyaz arka plan, koyu gri metin (#222). Sıcak, davetkâr, fotoğraf-öncelikli. Circular/sans-serif, yuvarlak köşeler (12px), yumuşak gölgeler. Büyük kart görselleri. Ton: misafirperver, insancıl, güven veren.",
    tokensCss: tokens({ brand: "#ff385c", bg: "#ffffff", surface: "#f7f7f7", ink: "#222222", muted: "#717171", radius: "12px", font: "'Circular', -apple-system, system-ui, sans-serif" }),
  },
  {
    id: "cursor", name: "Cursor", category: "Geliştirici", accent: "#6c8eef",
    designMd: "Mavi vurgu (#6c8eef) üzerine koyu arka plan (#0a0a0a), yüzey #141414. Minimal, kod-odaklı, keskin. Sans-serif + mono, sıkı tipografi. Köşeler hafif (6px), ince kenarlıklar. Gradyan vurgular. Ton: hızlı, modern, mühendis-odaklı.",
    tokensCss: tokens({ brand: "#6c8eef", bg: "#0a0a0a", surface: "#141414", ink: "#ededed", muted: "#8a8a8a", radius: "6px", font: "Inter, system-ui, sans-serif" }),
  },
];

/* Bundled + kullanıcının özel sistemleri (config.customDesignSystems). */
export function allDesignSystems(config: Config): DesignSystem[] {
  const custom = config.customDesignSystems ?? [];
  return [...bundledDesignSystems, ...custom];
}

export function designSystemById(config: Config, id: string | null | undefined): DesignSystem | undefined {
  if (!id) return undefined;
  return allDesignSystems(config).find((s) => s.id === id);
}

/* Üretim sistem promptu için marka sözleşmesi metni. */
export function designSystemPromptText(s: DesignSystem): string {
  return `Marka: ${s.name}\n${s.designMd}\nCSS değişkenleri mevcut (--brand, --bg, --surface, --ink, --muted, --radius, --font) — bunları kullan.`;
}
