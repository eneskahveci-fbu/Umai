import type { CapacitorConfig } from "@capacitor/cli";

/* Capacitor — tek kod tabanından iOS/Android kabuğu. Native uygulama, yayında
   olan web uygulamasını (server.url) yükler → ayrı build/static export gerekmez,
   web'deki her güncelleme mobilde de anında geçerli olur. Çevrimdışıyken
   `webDir` (mobile/) içindeki yerel yedek gösterilir. */
const config: CapacitorConfig = {
  appId: "ai.craftcoder.app",
  appName: "Craft Coder",
  webDir: "mobile",
  server: {
    // Üretim URL'i; geliştirme için CAP_SERVER_URL ile geçersiz kıl.
    url: process.env.CAP_SERVER_URL || "https://craft-coder.vercel.app",
    cleartext: false,
  },
  ios: { contentInset: "always" },
  android: { backgroundColor: "#111110" },
};

export default config;
