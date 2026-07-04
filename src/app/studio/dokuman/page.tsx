"use client";

import { DocsStudio } from "@/components/studio/DocsStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/dokuman — Doküman Stüdyosu (brief → blok tabanlı doküman) rotası. */
export default function DocsPage() {
  return (
    <SurfacePage flag="docsStudioOpen">
      <DocsStudio />
    </SurfacePage>
  );
}
