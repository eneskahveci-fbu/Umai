import type { Metadata } from "next";
import { StudioGate } from "./StudioGate";

export const metadata: Metadata = {
  title: "Stüdyo — UMAI",
  description: "Brief yaz, AI tasarlasın: web · doküman · görsel. Ücretsiz, tarayıcıda.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioGate>{children}</StudioGate>;
}
