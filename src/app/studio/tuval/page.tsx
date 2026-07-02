"use client";

import { DesignStudio } from "@/components/DesignStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/tuval — katman/tuval editörü (slayt · afiş · sosyal) gerçek rotası. */
export default function CanvasPage() {
  return (
    <SurfacePage flag="designStudioOpen">
      <DesignStudio />
    </SurfacePage>
  );
}
