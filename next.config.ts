import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/* WebContainer needs cross-origin isolation (SharedArrayBuffer).
   Apply COEP only on /app so other pages (with third-party iframes/images) stay open. */
const COOP_COEP_HEADERS = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/app/:path*",
        headers: COOP_COEP_HEADERS,
      },
      {
        source: "/app",
        headers: COOP_COEP_HEADERS,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  compress: true,
  turbopack: {
    /* web-tree-sitter, tarayıcıda kullanılmayan Node.js yollarına başvuruyor
       (fs/promises, module). Bunları tarayıcı derlemesinde boş modüle yönlendir. */
    resolveAlias: {
      "fs/promises": { browser: "./empty.ts" },
      module: { browser: "./empty.ts" },
    },
  },
};

export default nextConfig;
