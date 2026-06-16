/** Hazır (kürate) skill kataloğu — tek tıkla eklenir, %100 ücretsiz.
 *  İçerikler özgün ve serbestçe kullanılabilir; harici bir kaynağa bağımlı
 *  değildir (çevrimdışı çalışır). "URL'den içe aktar" ile GitHub/gist gibi
 *  farklı platformlardan da skill çekilebilir (SkillImport bileşeni). */
export interface CatalogSkill {
  title: string;
  tags: string[];
  content: string;
}

export const CATALOG_SKILLS: CatalogSkill[] = [
  {
    title: "Temiz Kod Kuralları",
    tags: ["kod", "kalite"],
    content:
      "Kod yazarken şu ilkeleri uygula:\n" +
      "- İsimler niyeti açıklasın; kısaltma ve tek-harf yerine anlamlı adlar kullan.\n" +
      "- Fonksiyonlar tek bir iş yapsın ve kısa olsun; yan etkileri açıkça belirt.\n" +
      "- Tekrarı (DRY) ortadan kaldır ama erken soyutlamadan kaçın.\n" +
      "- Derin iç içe koşulları erken-dönüş (guard clause) ile düzleştir.\n" +
      "- Yorum 'neden'i anlatsın, 'ne'yi değil; ölü kodu sil, bırakma.\n" +
      "- Sihirli sayıları adlandırılmış sabitlere çıkar.",
  },
  {
    title: "Test Yazımı",
    tags: ["test", "kalite"],
    content:
      "Test üretirken:\n" +
      "- Arrange-Act-Assert düzenini izle; her test tek bir davranışı doğrulasın.\n" +
      "- Mutlu yolun yanında sınır durumları, boş/null girdi ve hata senaryolarını da kapsa.\n" +
      "- Test adları davranışı anlatsın: 'X olduğunda Y döner'.\n" +
      "- Dış bağımlılıkları (ağ, zaman, rastgele) izole et/mock'la; testler deterministik olsun.\n" +
      "- Kırılgan, uygulama detayına bağlı assert'lerden kaçın; davranışı test et.",
  },
  {
    title: "Commit Mesajları (Conventional)",
    tags: ["git", "süreç"],
    content:
      "Commit mesajlarını Conventional Commits biçiminde yaz:\n" +
      "- Biçim: `<tür>(kapsam): kısa özet` (ör. `feat(auth): Google ile giriş ekle`).\n" +
      "- Türler: feat, fix, docs, refactor, test, chore, perf, build, ci.\n" +
      "- Özet emir kipinde ve ~50 karakteri aşmasın; sonuna nokta koyma.\n" +
      "- Gerekirse boş satırdan sonra gövdede 'neden'i açıkla.\n" +
      "- Kırıcı değişiklikleri `BREAKING CHANGE:` ile belirt.",
  },
  {
    title: "Güvenlik İncelemesi",
    tags: ["güvenlik"],
    content:
      "Kodu güvenlik açısından incelerken şunları kontrol et:\n" +
      "- Tüm dış girdiyi doğrula/temizle; SQL/komut/HTML enjeksiyonuna karşı parametrele/escape et.\n" +
      "- Sırları (anahtar, token) koda gömme; ortam değişkeni kullan.\n" +
      "- Kimlik doğrulama ve yetkilendirmeyi sunucu tarafında uygula; istemciye güvenme.\n" +
      "- Hata mesajlarında hassas detay sızdırma.\n" +
      "- Bağımlılıkların bilinen açıklarını (CVE) ve aşırı izinleri gözden geçir.",
  },
  {
    title: "Performans Optimizasyonu",
    tags: ["performans"],
    content:
      "Performans iyileştirmesi yaparken:\n" +
      "- Önce ÖLÇ (profil çıkar), tahmin etme; darboğazı veriyle bul.\n" +
      "- Algoritmik karmaşıklığı (O(n²)→O(n)) mikro-optimizasyondan önce düşür.\n" +
      "- Gereksiz tekrar-render/yeniden-hesaplamayı önle (memoization, doğru bağımlılıklar).\n" +
      "- N+1 sorgularını topluca (batch) çöz; pahalı işleri önbelleğe al.\n" +
      "- Büyük listelerde sanallaştırma ve tembel yükleme kullan.",
  },
  {
    title: "Erişilebilirlik (a11y)",
    tags: ["a11y", "ui"],
    content:
      "Arayüz üretirken erişilebilirliği gözet:\n" +
      "- Anlamlı (semantic) HTML kullan; div yerine button/nav/main vb.\n" +
      "- Her etkileşimli öğe klavyeyle ulaşılabilir olsun; görünür focus halkası bırak.\n" +
      "- Görselllere alt metni, ikon-butonlara aria-label ver.\n" +
      "- Renk kontrastı WCAG AA'yı (en az 4.5:1) sağlasın; bilgiyi yalnız renge bağlama.\n" +
      "- Form alanlarını label ile ilişkilendir; hata mesajlarını programatik bağla.",
  },
  {
    title: "Yöntemli Hata Ayıklama",
    tags: ["debug"],
    content:
      "Bir hatayı çözerken sistematik ilerle:\n" +
      "- Önce hatayı güvenilir biçimde TEKRARLA (minimal repro).\n" +
      "- Beklenen ile gerçekleşen davranışı net yaz.\n" +
      "- İkili arama ile sorunu daralt; değişkenleri tek tek sabitle.\n" +
      "- Varsayımları logla/doğrula; 'çalışıyor olmalı' deme, kanıtla.\n" +
      "- Kök nedeni bul; belirtiyi değil nedeni düzelt ve bir regresyon testi ekle.",
  },
];
