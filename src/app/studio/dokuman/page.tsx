"use client";

import { ContentHub } from "@/components/studio/ContentHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/dokuman — İçerik grubu kabuğu, Doküman modu açık başlar. */
export default function DocsPage() {
  return (
    <SurfacePage flag="docsStudioOpen">
      <ContentHub />
    </SurfacePage>
  );
}
