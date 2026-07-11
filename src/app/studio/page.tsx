"use client";

/* /studio — Tasarım Stüdyosu: Claude Design'a paralel, tek canlı tasarım
   tuvali (sol sohbet + sağ artifact önizleme), hazır şablonlar ve marka
   stilleriyle. `/studio/sunum` ve `/studio/tuval` buraya yönlenir. */

import { SurfacePage } from "@/components/studio/SurfacePage";
import { DesignStudio } from "@/components/DesignStudio";

export default function StudioPage() {
  return (
    <SurfacePage flag="studioOpen">
      <DesignStudio />
    </SurfacePage>
  );
}
