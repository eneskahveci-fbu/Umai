"use client";

import { DesignHub } from "@/components/studio/DesignHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/gorsel — Tasarım grubu kabuğu, Görüntü modu açık başlar. */
export default function ImagePage() {
  return (
    <SurfacePage flag="imageStudioOpen">
      <DesignHub />
    </SurfacePage>
  );
}
