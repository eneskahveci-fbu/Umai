"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/sunum — Tasarım grubu kabuğu, Sunum modu açık başlar. */
export default function SlidesPage() {
  return (
    <SurfacePage flag="slidesStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
