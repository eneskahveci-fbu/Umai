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
  title: "Craft.Coder — AI kod asistanı",
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
  openGraph: {
    title: "Craft.Coder — AI kod asistanı",
    description:
      "İstediğin modelle çalışan AI kod asistanı. Sohbet, GitHub Coder, gizli mod.",
    siteName: "Craft.Coder",
    type: "website",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Craft.Coder — AI kod asistanı",
    description:
      "İstediğin modelle çalışan AI kod asistanı. Sohbet, GitHub Coder, gizli mod.",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://craft-coder.vercel.app"),
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
        {/* Tema flash'ını önle */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem('craftai_config')||'{}');if(c.theme==='light')document.documentElement.classList.add('light')}catch{}`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
