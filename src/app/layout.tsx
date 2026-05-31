import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "highlight.js/styles/atom-one-dark.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Craft.Coder — AI kod asistanı",
    template: "%s — Craft.Coder",
  },
  description:
    "OpenAI-uyumlu herhangi bir modelle çalışan AI kod asistanı. Sohbet, gizli sohbet, geçmiş senkron ve GitHub deposuna bağlı Coder sekmesi.",
  keywords: [
    "AI",
    "kod asistanı",
    "Hugging Face",
    "DeepSeek",
    "OpenRouter",
    "chat",
    "code assistant",
  ],
  authors: [{ name: "Enes Kahveci", url: "mailto:eneskahveci.bs@gmail.com" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Craft.Coder — AI kod asistanı",
    description:
      "İstediğin modelle çalışan AI kod asistanı. Sohbet, GitHub Coder, gizli mod.",
    siteName: "Craft.Coder",
    type: "website",
    locale: "tr_TR",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Craft.Coder — AI kod asistanı",
    description:
      "İstediğin modelle çalışan AI kod asistanı. Sohbet, GitHub Coder, gizli mod.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://craft-coder.vercel.app"),
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e13" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  /* `cover` lets the page extend behind the notch / home indicator;
     safe-area-inset-* in CSS handles the actual padding. */
  viewportFit: "cover" as const,
  /* Don't disable user-scalable — accessibility. iOS auto-zoom on
     input focus is solved by 16px+ font-size on form fields. */
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* iOS PWA meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Craft.AI" />
        <link rel="apple-touch-icon" href="/icon" />
        {/* Tema flash'ını önle (private-mode safe) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem('craftai_config')||'{}');if(c.theme==='light')document.documentElement.classList.add('light');if(c.accentColor)document.documentElement.classList.add('accent-'+c.accentColor);if(c.fontScale)document.documentElement.classList.add('font-'+c.fontScale)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
