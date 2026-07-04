"use client";

import { SlidesStudio } from "@/components/studio/SlidesStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/sunum — Sunum Stüdyosu (brief → slayt destesi) gerçek rotası. */
export default function SlidesPage() {
  return (
    <SurfacePage flag="slidesStudioOpen">
      <SlidesStudio />
    </SurfacePage>
  );
}
