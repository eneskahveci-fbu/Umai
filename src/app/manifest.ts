import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Craft.AI — AI kod asistanı",
    short_name: "Craft.AI",
    description:
      "OpenAI-uyumlu herhangi bir modelle çalışan AI kod asistanı.",
    start_url: "/app",
    id: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#111110",
    theme_color: "#c8a87e",
    orientation: "any",
    lang: "tr",
    dir: "ltr",
    categories: ["productivity", "developer"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "maskable" },
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
