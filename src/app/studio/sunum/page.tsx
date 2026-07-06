"use client";

import { DesignHub } from "@/components/studio/DesignHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/sunum — Tasarım grubu kabuğu, Sunum modu açık başlar. */
export default function SlidesPage() {
  return (
    <SurfacePage flag="slidesStudioOpen">
      <DesignHub />
    </SurfacePage>
  );
}
