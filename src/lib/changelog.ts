/* Kullanıcıya dönük değişiklik günlüğü — /changelog sayfasının veri kaynağı.
   Girdiler gerçek GitLab main birleşme geçmişinden derlenmiştir (bkz. `git log`);
   her satır tek bir MR/özellik değil, kullanıcının fark edeceği anlamlı bir
   kilometre taşını temsil eder — iç refactor/test/lint turları kasıtlı olarak
   dışarıda bırakılmıştır. Yeni bir kullanıcı-görünür özellik/değişiklik
   çıktığında en üste (en yeni tarih) yeni bir girdi eklenir. */

export type ChangelogTag = "yeni" | "iyilestirme" | "duzeltme" | "degisiklik";

export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  tag: ChangelogTag;
  title: string;
  description: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-07-17",
    tag: "yeni",
    title: "PR/MR yorumu: incelemeyi doğrudan GitHub/GitLab'a yaz",
    description:
      "Sohbette üretilen PR/MR inceleme yanıtı artık kopyala-yapıştır gerektirmiyor — mesaj balonundaki yeni aksiyonla gerçek bir yorum olarak doğrudan GitHub veya GitLab'a gönderilebiliyor.",
  },
  {
    date: "2026-07-16",
    tag: "yeni",
    title: "Sohbette yeniden oluşturma artık sürüm geçmişi tutuyor",
    description:
      "Bir yanıtı yeniden oluşturduğunda önceki sürümler kaybolmuyor — aralarında gezinebilir, ayrıca iki yanıtı yan yana karşılaştırma görünümüyle inceleyebilirsin.",
  },
  {
    date: "2026-07-16",
    tag: "yeni",
    title: "Defter: çok sesli podcast özeti ve tıklanabilir atıflar",
    description:
      "Craft Defter artık kaynaklarından çok sesli bir podcast özeti üretebiliyor; yanıtlardaki [n] atıflarına tıklayınca ilgili kaynağa doğrudan atlıyorsun. Ayrıca tek tıkla Çalışma Rehberi ve SSS üretimi eklendi.",
  },
  {
    date: "2026-07-16",
    tag: "yeni",
    title: "Anket: dosya yükleme soruları ve çok sayfalı formlar",
    description:
      "Craft Anket'e dosya yükleme soru tipi ve çok sayfalı form desteği eklendi. Craft Kartlar'a cloze (boşluk doldurma) kart tipi ve Anki'den içe aktarma geldi.",
  },
  {
    date: "2026-07-16",
    tag: "iyilestirme",
    title: "Ayarlarda harcama/kullanım bütçe uyarısı",
    description:
      "Model ayarlarına aylık bütçe eşiği tanımlayabiliyorsun; eşiğe yaklaşınca/aşınca uyarılıyorsun.",
  },
  {
    date: "2026-07-14",
    tag: "yeni",
    title: "Çalışma modları: Plan / Oto / Değişiklikleri Onayla",
    description:
      "Composer'da artık üç çalışma modu arasında seçim yapabiliyorsun. Ayrıca dosya yükleme kutusuna doğrudan kamerayla fotoğraf çekme desteği eklendi.",
  },
  {
    date: "2026-07-14",
    tag: "yeni",
    title: "Eklentiler mağazası: ~30 MCP entegrasyonu galerisi",
    description:
      "Notion, Slack, Drive, Linear, Figma, PostgreSQL ve daha fazlası için küratörlü bir eklenti galerisi eklendi. Zaman ve Adım Adım Düşünme gibi bazı araçlar kurulum gerektirmeden (yerleşik) çalışıyor.",
  },
  {
    date: "2026-07-14",
    tag: "iyilestirme",
    title: "Kenar çubuğu yeniden tasarlandı",
    description:
      "Sol kenar çubuğu Claude.ai'ye paralel bir yapıya kavuştu; Eklentiler ve Araçlar için yeni, hızlı erişilebilir girişler eklendi.",
  },
  {
    date: "2026-07-13",
    tag: "yeni",
    title: "Kroki ve Kartlar + Vurgular stüdyoları",
    description:
      "Zihin haritası çıkaran Kroki stüdyosu ile aralıklı tekrar (Leitner) yöntemiyle çalışan Kartlar + Vurgular stüdyosu eklendi.",
  },
  {
    date: "2026-07-13",
    tag: "yeni",
    title: "Yazım Asistanı",
    description:
      "Craft Doküman'da metin bloklarını AI'ya denetletip yazım/dilbilgisi önerilerini tek tek veya toplu uygulayabiliyorsun.",
  },
  {
    date: "2026-07-13",
    tag: "yeni",
    title: "BYOK görsel üretimi ve anahtarsız ücretsiz sağlayıcılar",
    description:
      "Kendi anahtarınla gpt-image/Imagen gibi modellerle görsel üretebiliyorsun; anahtarsız kullanım için yeni ücretsiz sağlayıcılar eklendi.",
  },
  {
    date: "2026-07-13",
    tag: "yeni",
    title: "Composer'da AI Chips ve İşaretle & Değiştir",
    description:
      "Composer boşken küratörlü hızlı komut çipleri (AI Chips) çıkıyor. Canlı önizlemede bir öğeye tıklayıp AI'ya \"bunu değiştir\" diyebiliyorsun (İşaretle & Değiştir).",
  },
  {
    date: "2026-07-11",
    tag: "yeni",
    title: "Tasarım Stüdyosu yeniden kuruldu",
    description:
      "Tasarım Stüdyosu artık tek, canlı bir tasarım tuvali ve hazır şablon galerisiyle çalışıyor — Claude'un kendi Design yüzeyine paralel bir deneyim.",
  },
  {
    date: "2026-07-11",
    tag: "iyilestirme",
    title: "Navigasyon sadeleştirildi",
    description:
      "Üst çubuk ve genel navigasyon daha tanıdık bir yapıya kavuştu; Projeler artık klasör gibi çalışıp içindeki sohbetleri gruplayabiliyor.",
  },
  {
    date: "2026-07-10",
    tag: "degisiklik",
    title: "Yeniden markalama: Craft → UMAI",
    description:
      "Uygulama yeni adı ve \"Taş & Çam\" temasıyla (açık + koyu modda uyumlu) yeniden markalandı.",
  },
  {
    date: "2026-07-08",
    tag: "iyilestirme",
    title: "Erişilebilirlik denetimi ve admin analitik paneli",
    description:
      "Modal pencereler ve simge-only butonlar için erişilebilirlik (a11y) denetimi genişletildi; yöneticiler için kullanım analitiği paneli eklendi.",
  },
  {
    date: "2026-06-24",
    tag: "yeni",
    title: "Stüdyo temelleri",
    description:
      "Stüdyo kabuğu, hazır şablonlar, Skills entegrasyonu, kayıtlı projeler, sunum modu ve temel otomasyonlarla ilk kez hayata geçti.",
  },
  {
    date: "2026-06-23",
    tag: "yeni",
    title: "Artifact yayınlama ve derin araştırma modu",
    description:
      "Kod/tasarım çıktılarını herkese açık bir bağlantıyla yayınlayabiliyorsun; sohbete çok adımlı derin araştırma modu eklendi.",
  },
  {
    date: "2026-06-19",
    tag: "yeni",
    title: "Fiyatlandırma sayfası ve Pro abonelik",
    description:
      "Basit, şeffaf bir fiyatlandırma sayfası ve Pro abonelik altyapısı (hazır kullanım + bulut senkron) eklendi.",
  },
  {
    date: "2026-06-18",
    tag: "yeni",
    title: "Otomatik ajan ekibi (swarm)",
    description:
      "Karmaşık istekler için planlayıcı → paralel işçiler → birleştirici akışıyla çalışan otomatik ajan ekibi ve PWA otomatik güncelleme eklendi.",
  },
];
