"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/gorsel — Tasarım grubu kabuğu, Görüntü modu açık başlar. */
export default function ImagePage() {
  return (
    <SurfacePage flag="imageStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
