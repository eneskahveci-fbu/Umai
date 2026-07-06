"use client";

import { ContentHub } from "@/components/studio/ContentHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/anket — İçerik grubu kabuğu, Anket modu açık başlar. */
export default function FormsPage() {
  return (
    <SurfacePage flag="formsStudioOpen">
      <ContentHub />
    </SurfacePage>
  );
}
