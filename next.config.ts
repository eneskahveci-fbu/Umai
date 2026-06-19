import type { NextConfig } from "next";

/* CSP politikası — tek kaynak. connect-src https:/wss: geniş (BYOK doğrudan
   çağrılar); WebContainer için eval/blob izinli. */
const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/* CSP_ENFORCE=1 → gerçek engelleyici CSP. Aksi halde Report-Only (varsayılan):
   hiçbir şeyi engellemez, yalnızca ihlalleri raporlar → canlı site bozulmaz.
   Sahip, raporları doğruladıktan sonra tek env bayrağıyla enforce'a geçer. */
const CSP_HEADER = process.env.CSP_ENFORCE === "1"
  ? { key: "Content-Security-Policy", value: CSP_VALUE }
  : { key: "Content-Security-Policy-Report-Only", value: CSP_VALUE };

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
  /* HSTS — tarayıcıya bu siteyi yalnızca HTTPS ile aç dedirtir. */
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  CSP_HEADER,
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
      /* Statik (içerik-hash'li) varlıklar: 1 yıl, immutable → Cloudflare/CDN uzun
         süre önbelleğe alır, kaynak isabeti azalır. */
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      /* API uçları DİNAMİK (BYOK/anahtar bağlamlı) → asla önbelleğe alınmaz. */
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
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
