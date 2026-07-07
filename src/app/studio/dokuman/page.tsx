"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/dokuman — tek stüdyo kabuğu — Doküman modu açık başlar. */
export default function DocsPage() {
  return (
    <SurfacePage flag="docsStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
