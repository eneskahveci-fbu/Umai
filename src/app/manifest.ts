import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Craft.AI — AI kod asistanı",
    short_name: "Craft.AI",
    description:
      "OpenAI-uyumlu herhangi bir modelle çalışan AI kod asistanı.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0e0e13",
    theme_color: "#7c5cff",
    orientation: "any",
    lang: "tr",
    categories: ["productivity", "developer"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon", sizes: "32x32", type: "image/png" },
    ],
  };
}
