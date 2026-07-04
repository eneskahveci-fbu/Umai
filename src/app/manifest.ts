import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Craft — AI kod asistanı",
    short_name: "Craft",
    description:
      "OpenAI-uyumlu herhangi bir modelle çalışan AI kod asistanı.",
    start_url: "/app",
    id: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#111110",
    theme_color: "#111110",
    orientation: "any",
    lang: "tr",
    dir: "ltr",
    categories: ["productivity", "developer"],
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=192&maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Yeni sohbet",
        short_name: "Yeni",
        description: "Boş bir oturum başlat",
        url: "/app?new=1",
      },
    ],
  };
}
