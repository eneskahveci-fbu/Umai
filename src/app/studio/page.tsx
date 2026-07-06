"use client";

import { DesignHub } from "@/components/studio/DesignHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio — Tasarım grubu (Tasarım/Sunum/Tuval/Görüntü) tek kabuğu. */
export default function StudioPage() {
  return (
    <SurfacePage flag="studioOpen">
      <DesignHub />
    </SurfacePage>
  );
}
