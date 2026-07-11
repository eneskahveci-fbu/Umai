import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stüdyo — Umai",
  description: "Brief yaz, AI tasarlasın: web · doküman · görsel. Ücretsiz, tarayıcıda.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
