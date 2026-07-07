"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/anket — tek stüdyo kabuğu — Anket modu açık başlar. */
export default function FormsPage() {
  return (
    <SurfacePage flag="formsStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
