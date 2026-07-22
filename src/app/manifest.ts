import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UMAI — Yapay Zeka Stüdyosu",
    short_name: "UMAI",
    description:
      "Herkes için yapay zeka stüdyosu. Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp deponuza bağlanın.",
    start_url: "/app",
    id: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#171a16",
    theme_color: "#171a16",
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
