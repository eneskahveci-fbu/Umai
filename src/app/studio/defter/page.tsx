"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/defter — tek stüdyo kabuğu — Defter modu açık başlar. */
export default function NotebookPage() {
  return (
    <SurfacePage flag="notebookStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
