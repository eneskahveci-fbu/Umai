import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayarlar — UMAI",
  description: "Model, Git, eklenti ve hesap ayarları.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
