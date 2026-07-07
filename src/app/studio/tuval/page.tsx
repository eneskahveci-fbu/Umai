"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/tuval — Tasarım grubu kabuğu, Tuval modu açık başlar. */
export default function CanvasPage() {
  return (
    <SurfacePage flag="designStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
