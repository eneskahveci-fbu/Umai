"use client";

import { FormsStudio } from "@/components/studio/FormsStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/anket — Anket Stüdyosu (brief → bağımsız HTML anketi) rotası. */
export default function FormsPage() {
  return (
    <SurfacePage flag="formsStudioOpen">
      <FormsStudio />
    </SurfacePage>
  );
}
