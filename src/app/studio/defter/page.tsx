"use client";

import { ContentHub } from "@/components/studio/ContentHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/defter — İçerik grubu kabuğu, Defter modu açık başlar. */
export default function NotebookPage() {
  return (
    <SurfacePage flag="notebookStudioOpen">
      <ContentHub />
    </SurfacePage>
  );
}
