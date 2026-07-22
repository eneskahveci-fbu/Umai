import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono, Noto_Emoji } from "next/font/google";
import "./globals.css";
import { NativeInit } from "@/components/NativeInit";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
});

/* Başlıklar/hero metinler için sıcak editoryal serif — Perplexity Serif /
   Anthropic Serif ruhuna (grotesk sans + editoryal serif ikilisi) benzer,
   serbestçe kullanılabilir bir eşleşme. Gövde metni Inter'de kalır. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
});

/* Monokrom emoji fontu — tüm emojileri tek renk glif olarak çizer ve metnin
   rengini (currentColor) izler → aydınlık temada koyu, karanlıkta açık. Emoji
   yazı tipi yığınının başına konur (globals.css). */
const notoEmoji = Noto_Emoji({
  variable: "--font-emoji",
  subsets: ["emoji"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "UMAI — Yapay Zeka Stüdyosu",
    template: "%s — UMAI",
  },
  description:
    "Herkes için yapay zeka stüdyosu. Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp GitHub/GitLab depona bağlan. Kurulum yok, ücretsiz başlar.",
  keywords: [
    "yapay zeka stüdyosu",
    "AI kod asistanı",
    "web sitesi tasarımı",
    "sunum tasarımı",
    "görsel üretimi",
    "yapay zeka",
    "Hugging Face",
    "DeepSeek",
    "OpenRouter",
    "Anthropic Claude",
    "Google Gemini",
    "Groq",
    "Ollama",
    "chat",
    "code assistant",
    "GitHub Coder",
    "ücretsiz AI",
    "model bağımsız",
    "UMAI",
  ],
  authors: [{ name: "Enes Kahveci", url: "mailto:eneskahveci.bs@gmail.com" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "UMAI — Yapay Zeka Stüdyosu",
    description:
      "Herkes için yapay zeka stüdyosu. Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp deponuza bağlanın.",
    siteName: "UMAI",
    type: "website",
    locale: "tr_TR",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "UMAI — Yapay Zeka Stüdyosu",
    description:
      "Herkes için yapay zeka stüdyosu. Web sitesi ve sunum tasarla, görsel üret, her şeyi sor — ya da kod yazıp deponuza bağlanın.",
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://umai.vercel.app"),
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#171a16" },
    { media: "(prefers-color-scheme: light)", color: "#ece7de" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  /* `cover` lets the page extend behind the notch / home indicator;
     safe-area-inset-* in CSS handles the actual padding. */
  viewportFit: "cover" as const,
  /* Klavye açıldığında düzeni yeniden boyutlandır (composer klavyenin altında
     kaybolmasın) — destekleyen tarayıcılarda etkili, diğerlerinde zararsız. */
  interactiveWidget: "resizes-content" as const,
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoEmoji.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="UMAI" />
        {/* apple-touch-icon (180px) src/app/apple-icon.tsx'ten otomatik enjekte edilir */}
        {/* Tema flash'ını önle (private-mode safe) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem('craftai_config')||'{}');if(c.theme==='light')document.documentElement.classList.add('light');if(c.accentColor)document.documentElement.classList.add('accent-'+c.accentColor);if(c.fontScale)document.documentElement.classList.add('font-'+c.fontScale)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full"><NativeInit />{children}</body>
    </html>
  );
}
