/* Stüdyo sabitleri — çıktı türü skilleri, tasarım yönleri ve cihaz çerçeveleri.
   FAZ 1 küratörlü set; sonraki fazlarda genişler (skiller, eklentiler). */

export interface StudioSkill {
  id: string;
  name: string;
  icon: string;          // emoji
  desc: string;
  /** Gruplama için kategori (Web · Uygulama · Pazarlama · İçerik · Bileşen). */
  category: string;
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
  // ── Web ──────────────────────────────────────────────────────────────
  {
    id: "landing", name: "Landing Sayfası", icon: "🚀", category: "Web",
    desc: "Hero, özellikler, CTA ile pazarlama açılış sayfası",
    instructions: "Bir ürün/hizmet için yüksek dönüşümlü, modern bir LANDING sayfası üret: dikkat çekici hero (başlık + alt başlık + birincil CTA), 3-6 özellik bölümü, sosyal kanıt, fiyatlandırma/CTA ve sade footer. Akıcı boşluk ritmi ve görsel hiyerarşi şart.",
    defaultDevice: "web",
  },
  {
    id: "marketing", name: "Pazarlama Sitesi", icon: "🌐", category: "Web",
    desc: "Çok bölümlü kurumsal/ürün sitesi",
    instructions: "Çok bölümlü bir PAZARLAMA SİTESİ sayfası üret: yapışkan navigasyon, hero, faydalar, nasıl çalışır, müşteri logoları, görüş (testimonial), SSS ve footer. Tutarlı bölüm ritmi, güçlü CTA tekrarları.",
    defaultDevice: "web",
  },
  {
    id: "pricing", name: "Fiyatlandırma", icon: "💳", category: "Web",
    desc: "Plan karşılaştırma + CTA",
    instructions: "Bir FİYATLANDIRMA sayfası üret: 3 plan kartı (öne çıkan plan vurgulu), özellik karşılaştırma listesi, aylık/yıllık geçiş, SSS ve net CTA. Hizalı, taranabilir, güven veren.",
    defaultDevice: "web",
  },
  {
    id: "blog", name: "Blog / Makale", icon: "📝", category: "Web",
    desc: "Okunabilir makale sayfası",
    instructions: "Bir BLOG/MAKALE sayfası üret: başlık + meta (yazar/tarih), okunabilir tipografi (65-75ch satır), ara başlıklar, alıntı, kod/görsel blokları, ilgili yazılar ve abonelik CTA. İçerik-öncelikli, sakin.",
    defaultDevice: "web",
  },
  {
    id: "portfolio", name: "Portfolyo", icon: "🎨", category: "Web",
    desc: "Kişisel/ajans vitrin sayfası",
    instructions: "Bir PORTFOLYO sayfası üret: kişisel hero (isim + uzmanlık), proje ızgarası (görselli kartlar), hakkında, yetenekler ve iletişim. Görsel-ağırlıklı, kişilikli ama temiz.",
    defaultDevice: "web",
  },
  {
    id: "error", name: "404 / Boş Durum", icon: "🚧", category: "Web",
    desc: "Hata veya boş durum ekranı",
    instructions: "Yaratıcı bir 404 (veya boş durum) ekranı üret: büyük illüstratif başlık, açıklama, birincil eylem ve geri dönüş linki. Ortalanmış, oyunbaz ama markaya uygun.",
    defaultDevice: "web",
  },
  // ── Uygulama ─────────────────────────────────────────────────────────
  {
    id: "dashboard", name: "Dashboard", icon: "📊", category: "Uygulama",
    desc: "Veri panosu — kartlar, grafikler, tablo",
    instructions: "Bir yönetim DASHBOARD'u üret: üst bar + sol kenar menü, özet metrik kartları (KPI), basit grafikler (CSS/SVG ile sahte veri) ve bir veri tablosu. Bilgi yoğun ama okunabilir; tutarlı kart/gölge/şebeke düzeni.",
    defaultDevice: "web",
  },
  {
    id: "mobile", name: "Mobil Uygulama", icon: "📱", category: "Uygulama",
    desc: "Telefon ekranı — uygulama arayüzü",
    instructions: "Bir MOBİL UYGULAMA ekranı üret (tek ekran): üst başlık, içerik listesi/kartlar, alt sekme çubuğu (tab bar). Dokunmatik hedefler büyük, telefon genişliğine uygun (≤430px). Modern, temiz mobil UI.",
    defaultDevice: "iphone",
  },
  {
    id: "onboarding", name: "Onboarding", icon: "👋", category: "Uygulama",
    desc: "Karşılama / kurulum akışı ekranı",
    instructions: "Bir ONBOARDING ekranı üret (mobil): ilerleme göstergesi, illüstrasyon/ikon, kısa başlık + açıklama, birincil 'Devam' ve 'Atla'. Sıcak, teşvik edici, az adımlı.",
    defaultDevice: "iphone",
  },
  {
    id: "settings", name: "Ayarlar Ekranı", icon: "⚙️", category: "Uygulama",
    desc: "Gruplu ayar listesi",
    instructions: "Bir AYARLAR ekranı üret: gruplanmış ayar satırları (toggle/seçim/ok), başlıklı bölümler, hesap kartı ve tehlikeli eylem bölgesi. Hizalı, taranabilir liste düzeni.",
    defaultDevice: "iphone",
  },
  {
    id: "auth", name: "Giriş / Kayıt", icon: "🔐", category: "Uygulama",
    desc: "Kimlik doğrulama ekranı",
    instructions: "Bir GİRİŞ/KAYIT ekranı üret: marka başlığı, e-posta/şifre alanları, birincil buton, sosyal giriş seçenekleri ve alt link. Ortalanmış kart, net odak durumları, güven veren.",
    defaultDevice: "web",
  },
  // ── İçerik ───────────────────────────────────────────────────────────
  {
    id: "deck", name: "Sunum (çok slayt)", icon: "🖼️", category: "İçerik",
    desc: "Çok slaytlı, gezinilebilir sunum",
    instructions: "Çok slaytlı bir SUNUM üret: güçlü kapak + içerik slaytları + kapanış. Büyük tipografi, nefes alan boşluk, marka renkleriyle tutarlı; projeksiyon için yüksek kontrast. (Slayt yapısı/gezinme ayrıca belirtilecek.)",
    defaultDevice: "web",
  },
  {
    id: "email", name: "E-posta Şablonu", icon: "✉️", category: "İçerik",
    desc: "Pazarlama/bülten e-postası",
    instructions: "Tek sütunlu, responsive bir E-POSTA şablonu üret (≤600px genişlik): logo/başlık, hero görsel/metin, içerik blokları, CTA butonu ve footer. Inline CSS, e-posta istemcisi uyumlu basit yapı.",
    defaultDevice: "web",
  },
  {
    id: "social", name: "Sosyal Görsel", icon: "📣", category: "İçerik",
    desc: "Sosyal medya kart/afiş düzeni",
    instructions: "Bir SOSYAL MEDYA görseli üret (kare 1:1 sahne): güçlü başlık, kısa destek metni, marka rengi arka plan/gradyan ve logo alanı. Büyük tipografi, küçük ekranda okunur, dikkat çekici.",
    defaultDevice: "web",
  },
  // ── Bileşen ──────────────────────────────────────────────────────────
  {
    id: "component", name: "UI Bileşeni", icon: "🧩", category: "Bileşen",
    desc: "Tek bileşen — kart, form, fiyat tablosu",
    instructions: "İstenen TEK UI bileşenini üret (ör. fiyatlandırma kartı, giriş formu, özellik kartı): odaklı, yeniden kullanılabilir, durumlarıyla (hover) birlikte. Ortalanmış sahne üzerinde sergile.",
    defaultDevice: "web",
  },
  {
    id: "table", name: "Veri Tablosu", icon: "🗂️", category: "Bileşen",
    desc: "Sıralanabilir/filtreli tablo",
    instructions: "Zengin bir VERİ TABLOSU bileşeni üret: başlık satırı (sıralama okları), zebra/hover satırlar, durum rozetleri, satır eylemleri, üst arama/filtre çubuğu ve sayfalama. Yoğun ama okunabilir.",
    defaultDevice: "web",
  },
];

/** Skilleri kategoriye göre grupla (picker UI için). */
export function skillsByCategory(): { category: string; skills: StudioSkill[] }[] {
  const order = ["Web", "Uygulama", "İçerik", "Bileşen"];
  const map = new Map<string, StudioSkill[]>();
  for (const s of STUDIO_SKILLS) { const a = map.get(s.category) ?? []; a.push(s); map.set(s.category, a); }
  return [...map.keys()]
    .sort((a, b) => (order.indexOf(a) + 99) - (order.indexOf(b) + 99))
    .map((category) => ({ category, skills: map.get(category)! }));
}

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
