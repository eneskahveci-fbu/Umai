/* Stüdyo sabitleri — çıktı türü skilleri, tasarım yönleri ve cihaz çerçeveleri.
   FAZ 1 küratörlü set; sonraki fazlarda genişler (skiller, eklentiler). */

export interface StudioSkill {
  id: string;
  name: string;
  icon: string;          // emoji
  desc: string;
  /** Üretim sistem promptuna eklenen çıktı-türüne özel talimat. */
  instructions: string;
  /** Varsayılan önizleme cihazı. */
  defaultDevice: DeviceId;
}

export type DeviceId = "web" | "iphone" | "pixel";

export interface StudioDevice {
  id: DeviceId;
  name: string;
  /** İçerik (iframe) genişliği px. */
  width: number;
  /** Telefon çerçevesi için yükseklik px (web'de yok = esnek). */
  height?: number;
  /** Telefon çerçeve görünümü mü. */
  phone: boolean;
}

export interface StudioDirection {
  id: string;
  name: string;
  /** Üretim promptuna eklenen estetik yön ipucu. */
  hint: string;
}

export const STUDIO_SKILLS: StudioSkill[] = [
  {
    id: "landing", name: "Landing Sayfası", icon: "🚀",
    desc: "Hero, özellikler, CTA ile pazarlama açılış sayfası",
    instructions: "Bir ürün/hizmet için yüksek dönüşümlü, modern bir LANDING sayfası üret: dikkat çekici hero (başlık + alt başlık + birincil CTA), 3-6 özellik bölümü, sosyal kanıt, fiyatlandırma/CTA ve sade footer. Akıcı boşluk ritmi ve görsel hiyerarşi şart.",
    defaultDevice: "web",
  },
  {
    id: "dashboard", name: "Dashboard", icon: "📊",
    desc: "Veri panosu — kartlar, grafikler, tablo",
    instructions: "Bir yönetim DASHBOARD'u üret: üst bar + sol kenar menü, özet metrik kartları (KPI), basit grafikler (CSS/SVG ile sahte veri) ve bir veri tablosu. Bilgi yoğun ama okunabilir; tutarlı kart/gölge/şebeke düzeni.",
    defaultDevice: "web",
  },
  {
    id: "mobile", name: "Mobil Uygulama", icon: "📱",
    desc: "Telefon ekranı — uygulama arayüzü",
    instructions: "Bir MOBİL UYGULAMA ekranı üret (tek ekran): üst başlık, içerik listesi/kartlar, alt sekme çubuğu (tab bar). Dokunmatik hedefler büyük, telefon genişliğine uygun (≤430px). Modern, temiz mobil UI.",
    defaultDevice: "iphone",
  },
  {
    id: "deck", name: "Sunum Slaytı", icon: "🖼️",
    desc: "Tek slayt — başlık/içerik düzeni",
    instructions: "Tek bir SUNUM SLAYTI üret (16:9): güçlü başlık, destekleyici madde/görsel düzeni, marka renkleriyle tutarlı. Büyük tipografi, nefes alan boşluk; projeksiyon için yüksek kontrast.",
    defaultDevice: "web",
  },
  {
    id: "email", name: "E-posta Şablonu", icon: "✉️",
    desc: "Pazarlama/bülten e-postası",
    instructions: "Tek sütunlu, responsive bir E-POSTA şablonu üret (≤600px genişlik): logo/başlık, hero görsel/metin, içerik blokları, CTA butonu ve footer. Inline CSS, e-posta istemcisi uyumlu basit yapı.",
    defaultDevice: "web",
  },
  {
    id: "component", name: "UI Bileşeni", icon: "🧩",
    desc: "Tek bileşen — kart, form, fiyat tablosu",
    instructions: "İstenen TEK UI bileşenini üret (ör. fiyatlandırma kartı, giriş formu, özellik kartı): odaklı, yeniden kullanılabilir, durumlarıyla (hover) birlikte. Ortalanmış sahne üzerinde sergile.",
    defaultDevice: "web",
  },
];

export const STUDIO_DIRECTIONS: StudioDirection[] = [
  { id: "minimal", name: "Minimal", hint: "Bol beyaz alan, az renk, ince tipografi, sade." },
  { id: "bold", name: "Cesur", hint: "Yüksek kontrast, büyük tipografi, canlı vurgu rengi, güçlü." },
  { id: "playful", name: "Eğlenceli", hint: "Yumuşak köşeler, canlı renkler, oyunbaz mikro-detaylar." },
  { id: "corporate", name: "Kurumsal", hint: "Güven veren, dengeli, profesyonel; nötr palet + tek vurgu." },
  { id: "editorial", name: "Editöryel", hint: "Dergi düzeni, serif başlık, ızgara temelli, sofistike." },
];

export const STUDIO_DEVICES: StudioDevice[] = [
  { id: "web", name: "Web", width: 1280, phone: false },
  { id: "iphone", name: "iPhone 15", width: 390, height: 844, phone: true },
  { id: "pixel", name: "Pixel", width: 412, height: 915, phone: true },
];

export function skillById(id: string | null | undefined): StudioSkill | undefined {
  return STUDIO_SKILLS.find((s) => s.id === id);
}
export function directionById(id: string | null | undefined): StudioDirection | undefined {
  return STUDIO_DIRECTIONS.find((d) => d.id === id);
}
export function deviceById(id: DeviceId): StudioDevice {
  return STUDIO_DEVICES.find((d) => d.id === id) ?? STUDIO_DEVICES[0];
}
