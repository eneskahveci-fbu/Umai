/* MCP (Model Context Protocol) uygulama galerisi — Tem 2026 kullanıcı kararı:
   "eklenti bağlama" gerçek servis-özel OAuth entegrasyonları YERİNE, zaten
   çalışan genel MCP altyapısı (config.mcpServers, /api/mcp) üzerine kurulu bir
   galeri olarak sunulur. Buradaki her girdi yalnızca AD/İKON/AÇIKLAMA'dır —
   BİLİNÇLİ OLARAK hiçbir varsayılan sunucu URL'si veya harici doküman linki
   İÇERMEZ: her servisin kendi MCP sunucusu (resmi ya da topluluk) farklı bir
   adres+kimlik doğrulama gerektirir, bunu kullanıcı kendi bulur/barındırır ve
   buraya yapıştırır. Bir kart tıklanınca yalnızca "Yeni Sunucu Ekle" formunun
   ad alanı o servisin adıyla doldurulur (bkz. ExtensionsSettings.tsx). */

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
  { id: "custom", name: "Özel sunucu", icon: "🔌", description: "Kendi barındırdığın herhangi bir MCP sunucusu." },
];
