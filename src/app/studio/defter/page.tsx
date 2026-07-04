"use client";

import { NotebookStudio } from "@/components/studio/NotebookStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/defter — Defter (kaynak-temelli sohbet + sesli özet) rotası. */
export default function NotebookPage() {
  return (
    <SurfacePage flag="notebookStudioOpen">
      <NotebookStudio />
    </SurfacePage>
  );
}
