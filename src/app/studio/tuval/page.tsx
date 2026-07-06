"use client";

import { DesignHub } from "@/components/studio/DesignHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/tuval — Tasarım grubu kabuğu, Tuval modu açık başlar. */
export default function CanvasPage() {
  return (
    <SurfacePage flag="designStudioOpen">
      <DesignHub />
    </SurfacePage>
  );
}
