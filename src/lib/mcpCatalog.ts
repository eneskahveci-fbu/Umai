/* MCP (Model Context Protocol) uygulama galerisi — Tem 2026 kullanıcı kararı:
   "eklenti bağlama" gerçek servis-özel OAuth entegrasyonları YERİNE, zaten
   çalışan genel MCP altyapısı (config.mcpServers, /api/mcp) üzerine kurulu bir
   galeri olarak sunulur. Buradaki her girdi yalnızca AD/İKON/AÇIKLAMA'dır —
   BİLİNÇLİ OLARAK hiçbir varsayılan sunucu URL'si veya harici doküman linki
   İÇERMEZ: her servisin kendi MCP sunucusu (resmi ya da topluluk) farklı bir
   adres+kimlik doğrulama gerektirir, bunu kullanıcı kendi bulur/barındırır ve
   buraya yapıştırır. Bir kart üzerindeki aç/kapat anahtarı, o karta karşılık
   gelen bir config.mcpServers girdisini (McpServer.catalogId ile eşlenir)
   oluşturur/aktif-pasif yapar (bkz. McpGallery.tsx) — GitHub/GitLab burada
   bilinçli olarak YOK, çünkü uygulamanın kendi gerçek OAuth tabanlı Git
   entegrasyonuyla (Ayarlar → Git) karışmasın istendi. */

export interface McpCatalogEntry {
  id: string;
  name: string;
  icon: string; // emoji — PROJECT_TEMPLATES ile aynı ikon dili
  description: string;
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  { id: "notion", name: "Notion", icon: "📝", description: "Notion sayfalarına ve veritabanlarına eriş." },
  { id: "slack", name: "Slack", icon: "💬", description: "Slack kanallarını ve mesajlarını oku." },
  { id: "drive", name: "Google Drive", icon: "📁", description: "Drive dosyalarını ara, içeriğini oku." },
  { id: "calendar", name: "Google Calendar", icon: "📅", description: "Takvim etkinliklerini görüntüle." },
  { id: "linear", name: "Linear", icon: "📐", description: "Linear görevlerini ve projelerini yönet." },
  { id: "jira", name: "Jira", icon: "🎫", description: "Jira biletlerini görüntüle ve güncelle." },
  { id: "figma", name: "Figma", icon: "🎨", description: "Figma tasarım dosyalarına eriş." },
  { id: "postgres", name: "PostgreSQL", icon: "🗄️", description: "Veritabanı şeması üzerinde sorgu çalıştır." },
  { id: "obsidian", name: "Obsidian", icon: "📓", description: "Kişisel not kasandaki notları oku ve düzenle." },
  { id: "filesystem", name: "Dosya Sistemi", icon: "📂", description: "Yerel bir dizindeki dosyaları oku/yaz (açık kaynak referans sunucu)." },
  { id: "memory", name: "Bellek", icon: "🧠", description: "Sohbetler arası kalıcı bilgi grafiği tutar." },
  { id: "fetch", name: "Web İçeriği", icon: "🌐", description: "Web sayfalarını getirip AI için temizler." },
  { id: "puppeteer", name: "Tarayıcı Otomasyonu", icon: "🖱️", description: "Gerçek bir tarayıcıda gezinip etkileşim kurar." },
  { id: "sequential-thinking", name: "Adım Adım Düşünme", icon: "🧩", description: "Karmaşık problemleri denetlenebilir adımlara böler." },
  { id: "sqlite", name: "SQLite", icon: "🗃️", description: "Yerel bir SQLite veritabanında sorgu çalıştırır." },
  { id: "time", name: "Zaman", icon: "🕐", description: "Saat dilimi dönüşümü ve zaman hesaplamaları yapar." },
  { id: "docker", name: "Docker", icon: "🐳", description: "Konteynerleri listele, başlat/durdur." },
  { id: "kubernetes", name: "Kubernetes", icon: "☸️", description: "Küme kaynaklarını görüntüle ve yönet." },
  { id: "sentry", name: "Sentry", icon: "🚨", description: "Hata takibi ve issue detaylarına eriş." },
  { id: "cloudflare", name: "Cloudflare", icon: "☁️", description: "DNS kayıtlarını ve Workers'ı yönet." },
  { id: "redis", name: "Redis", icon: "🔴", description: "Anahtar-değer önbelleğinde sorgu/komut çalıştırır." },
  { id: "todoist", name: "Todoist", icon: "✅", description: "Görev listelerini görüntüle ve güncelle." },
  { id: "trello", name: "Trello", icon: "📋", description: "Pano ve kartları görüntüle/taşı." },
  { id: "discord", name: "Discord", icon: "🎮", description: "Sunucu kanallarındaki mesajları oku/gönder." },
  { id: "spotify", name: "Spotify", icon: "🎵", description: "Müzik ara, çal, çalma listesi düzenle." },
  { id: "brave-search", name: "Brave Search", icon: "🦁", description: "Gizlilik odaklı web araması yapar." },
  { id: "airtable", name: "Airtable", icon: "📊", description: "Tablo tabanlı veritabanı kayıtlarına eriş." },
  { id: "confluence", name: "Confluence", icon: "📘", description: "Takım wiki sayfalarını okur/düzenler." },
  { id: "stripe", name: "Stripe", icon: "💳", description: "Ödeme ve abonelik verilerini sorgular." },
  { id: "everything", name: "Everything (Test)", icon: "🧪", description: "MCP özelliklerini denemek için referans sunucu." },
  { id: "custom", name: "Özel sunucu", icon: "🔌", description: "Kendi barındırdığın herhangi bir MCP sunucusu." },
];
