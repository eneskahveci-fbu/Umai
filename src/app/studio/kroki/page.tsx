"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/kroki — tek stüdyo kabuğu — Kroki (zihin haritası) modu açık başlar. */
export default function MapPage() {
  return (
    <SurfacePage flag="mapStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
