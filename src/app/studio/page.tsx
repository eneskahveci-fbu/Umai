"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio — tek stüdyo kabuğu (7 mod). */
export default function StudioPage() {
  return (
    <SurfacePage flag="studioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
