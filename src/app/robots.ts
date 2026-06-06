import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app"}/sitemap.xml`,
  };
}
