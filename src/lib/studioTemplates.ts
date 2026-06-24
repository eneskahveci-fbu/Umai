/* Stüdyo şablonları — tek tıkla hazır başlangıçlar (Open Design'ın template/plugin
   başlangıç noktalarına paralel). Her şablon brief + skill + (opsiyonel) tasarım
   sistemi + yön'ü önceden doldurur ve üretimi tetikler. Diziye ekle = görünür. */

export interface StudioTemplate {
  id: string;
  name: string;
  category: string;
  /** Kart küçük-resmi için gradyan rengi. */
  accent: string;
  brief: string;
  skillId: string;
  designSystemId?: string;
  directionId?: string;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // ── Landing ──────────────────────────────────────────────────────────
  { id: "saas-landing", name: "SaaS Landing", category: "Landing", accent: "#635bff",
    brief: "Bir B2B SaaS analitik platformu için landing sayfası: net değer önerili hero, ürün ekran görüntüsü alanı, 3 ana fayda, müşteri logoları, fiyatlandırma teaser ve güçlü kayıt CTA.",
    skillId: "landing", designSystemId: "stripe", directionId: "corporate" },
  { id: "ai-startup", name: "AI Startup", category: "Landing", accent: "#10a37f",
    brief: "Bir yapay zeka asistanı ürünü için minimal landing: cesur tek-cümle hero, demo alanı, 'nasıl çalışır' 3 adım, güven rozetleri ve bekleme listesi CTA.",
    skillId: "landing", designSystemId: "openai", directionId: "minimal" },
  { id: "mobile-app-promo", name: "Uygulama Tanıtım", category: "Landing", accent: "#ff385c",
    brief: "Bir mobil fitness uygulaması için tanıtım sayfası: telefon mockup hero, özellik kartları, kullanıcı yorumları, App Store/Play rozetleri ve indirme CTA.",
    skillId: "landing", designSystemId: "airbnb", directionId: "playful" },

  // ── Dashboard ────────────────────────────────────────────────────────
  { id: "analytics-dash", name: "Analitik Panosu", category: "Dashboard", accent: "#5e6ad2",
    brief: "Bir web analitik dashboard'u: sol menü, üst KPI kartları (ziyaretçi, dönüşüm, gelir), çizgi grafik, en çok ziyaret edilen sayfalar tablosu ve tarih filtresi.",
    skillId: "dashboard", designSystemId: "linear", directionId: "bold" },
  { id: "crypto-dash", name: "Kripto Panosu", category: "Dashboard", accent: "#3ecf8e",
    brief: "Bir kripto portföy dashboard'u: toplam bakiye kartı, varlık dağılımı, fiyat grafikleri ve işlem geçmişi tablosu. Koyu tema, yeşil/kırmızı değişim göstergeleri.",
    skillId: "dashboard", designSystemId: "supabase", directionId: "bold" },
  { id: "admin-panel", name: "Yönetim Paneli", category: "Dashboard", accent: "#2da44e",
    brief: "Bir e-ticaret yönetim paneli: sipariş özeti kartları, gelir grafiği, son siparişler tablosu (durum rozetli) ve hızlı eylemler.",
    skillId: "dashboard", designSystemId: "github", directionId: "corporate" },

  // ── Mobil ────────────────────────────────────────────────────────────
  { id: "banking-app", name: "Bankacılık Ekranı", category: "Mobil", accent: "#635bff",
    brief: "Bir mobil bankacılık uygulaması ana ekranı: bakiye kartı, hızlı eylemler (gönder/al/öde), son işlemler listesi ve alt sekme çubuğu.",
    skillId: "mobile", designSystemId: "stripe", directionId: "minimal" },
  { id: "music-app", name: "Müzik Çalar", category: "Mobil", accent: "#1db954",
    brief: "Bir müzik uygulaması 'şimdi çalıyor' ekranı: albüm kapağı, şarkı/sanatçı, ilerleme çubuğu, kontroller ve sıradaki şarkılar. Koyu, enerjik.",
    skillId: "mobile", designSystemId: "spotify", directionId: "bold" },
  { id: "travel-onboard", name: "Seyahat Onboarding", category: "Mobil", accent: "#ff385c",
    brief: "Bir seyahat uygulaması onboarding ekranı: güzel destinasyon görseli, ilerleme noktaları, davetkâr başlık + açıklama, 'Başla' ve 'Atla'.",
    skillId: "onboarding", designSystemId: "airbnb", directionId: "playful" },

  // ── İçerik ───────────────────────────────────────────────────────────
  { id: "product-deck", name: "Ürün Sunumu", category: "İçerik", accent: "#0f172a",
    brief: "Bir ürün lansmanı için açılış slaytı: büyük ürün adı, etkileyici alt başlık, arka planda soyut gradyan ve sunum tarihi/konuşmacı.",
    skillId: "deck", designSystemId: "vercel", directionId: "minimal" },
  { id: "newsletter", name: "Bülten E-postası", category: "İçerik", accent: "#d97757",
    brief: "Bir teknoloji bülteni e-postası: marka başlığı, haftanın öne çıkan haberi (görsel+özet), 3 kısa haber bloğu, 'Devamını oku' CTA'ları ve abonelik footer'ı.",
    skillId: "email", designSystemId: "claude", directionId: "editorial" },
  { id: "promo-social", name: "İndirim Görseli", category: "İçerik", accent: "#e31937",
    brief: "Bir sezon sonu indirimi için sosyal medya görseli (kare): büyük '%50 İNDİRİM' yazısı, kısa slogan, marka rengi gradyan arka plan ve marka adı.",
    skillId: "social", designSystemId: "tesla", directionId: "bold" },

  // ── Pazarlama ────────────────────────────────────────────────────────
  { id: "agency-site", name: "Ajans Sitesi", category: "Pazarlama", accent: "#a259ff",
    brief: "Bir yaratıcı dijital ajans için tek-sayfa site: cesur hero, hizmetler ızgarası, seçili işler vitrini, ekip ve iletişim CTA. Yaratıcı ama profesyonel.",
    skillId: "marketing", designSystemId: "figma", directionId: "bold" },
  { id: "pricing-page", name: "Fiyatlandırma", category: "Pazarlama", accent: "#10a37f",
    brief: "Bir SaaS için fiyatlandırma sayfası: 3 plan (Başlangıç/Pro/Kurumsal), Pro öne çıkan, özellik karşılaştırma listesi, aylık/yıllık geçiş ve SSS.",
    skillId: "pricing", designSystemId: "openai", directionId: "minimal" },
  { id: "portfolio-site", name: "Tasarımcı Portfolyo", category: "Pazarlama", accent: "#2f3437",
    brief: "Bir ürün tasarımcısı için portfolyo: sade kişisel hero (isim + ne yaptığı), proje ızgarası (görselli kartlar), hakkında ve iletişim.",
    skillId: "portfolio", designSystemId: "notion", directionId: "editorial" },

  // ── Sunum (çok slayt) ────────────────────────────────────────────────
  { id: "pitch-deck", name: "Yatırımcı Sunumu", category: "Sunum", accent: "#635bff",
    brief: "Bir startup için yatırımcı sunumu (çok slaytlı): kapak, problem, çözüm, pazar, ürün, iş modeli, ekip ve kapanış/CTA slaytları. Ok tuşlarıyla gezinilebilir.",
    skillId: "deck", designSystemId: "stripe", directionId: "corporate" },
  { id: "product-launch-deck", name: "Ürün Lansman Sunumu", category: "Sunum", accent: "#10a37f",
    brief: "Bir ürün lansmanı sunumu (çok slaytlı): etkileyici kapak, vizyon, özellikler, demo, fiyatlandırma ve teşekkür slaytları. Büyük tipografi, animasyonlu geçiş hissi.",
    skillId: "deck", designSystemId: "openai", directionId: "minimal" },
  { id: "webinar-deck", name: "Eğitim/Webinar Sunumu", category: "Sunum", accent: "#a259ff",
    brief: "Bir online eğitim/webinar sunumu (çok slaytlı): kapak, ajanda, 4 konu slaytı (başlık + maddeler), özet ve soru-cevap slaytı. Okunaklı, projeksiyon dostu.",
    skillId: "deck", designSystemId: "figma", directionId: "editorial" },

  // ── Uygulama ekranları ───────────────────────────────────────────────
  { id: "login-screen", name: "Giriş Ekranı", category: "Uygulama", accent: "#6c8eef",
    brief: "Modern bir giriş ekranı: marka başlığı, e-posta/şifre alanları, 'Beni hatırla', birincil giriş butonu, Google/GitHub ile giriş ve kayıt linki. Ortalanmış kart.",
    skillId: "auth", designSystemId: "cursor", directionId: "minimal" },
  { id: "settings-screen", name: "Ayarlar", category: "Uygulama", accent: "#611f69",
    brief: "Bir uygulama ayarlar ekranı: profil kartı, gruplu ayarlar (bildirimler, gizlilik, görünüm — toggle'lı), dil seçimi ve çıkış/hesap silme bölgesi.",
    skillId: "settings", designSystemId: "slack", directionId: "corporate" },
  { id: "empty-404", name: "404 Sayfası", category: "Uygulama", accent: "#5e6ad2",
    brief: "Yaratıcı bir 404 sayfası: büyük oyunbaz başlık, 'Sayfayı bulamadık' mesajı, ana sayfaya dön butonu ve arka planda soyut illüstrasyon hissi.",
    skillId: "error", designSystemId: "linear", directionId: "playful" },
];

export function templatesByCategory(): { category: string; items: StudioTemplate[] }[] {
  const map = new Map<string, StudioTemplate[]>();
  for (const t of STUDIO_TEMPLATES) { const a = map.get(t.category) ?? []; a.push(t); map.set(t.category, a); }
  return [...map.keys()].map((category) => ({ category, items: map.get(category)! }));
}
