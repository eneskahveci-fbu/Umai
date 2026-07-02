"use client";

import { StudioView } from "@/components/studio/StudioView";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio — Stüdyo (brief → AI tasarım) gerçek rotası. */
export default function StudioPage() {
  return (
    <SurfacePage flag="studioOpen">
      <StudioView />
    </SurfacePage>
  );
}
