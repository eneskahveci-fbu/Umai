import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stüdyo — Craft",
  description: "Brief yaz, AI tasarlasın: web · sunum · tuval · görsel. Ücretsiz, tarayıcıda.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
