"use client";

/* /studio — Open Design Platform (Birleşik Tasarım Stüdyosu).

   Önceki yapı:
   - /studio       → StudioHub (7 mod)
   - /studio/sunum → SlidesStudio
   - /studio/tuval → DesignStudio

   Yeni yapı:
   - /studio       → OpenDesignStudio (slayt+tuval+afiş+sosyal birleşik)
   - /studio/sunum → /studio (redirect)
   - /studio/tuval → /studio (redirect)
   - /studio/gorsel → ImageStudio
   - /studio/dokuman → DocsStudio
   - /studio/anket → FormsStudio
   - /studio/defter → NotebookStudio */

import { SurfacePage } from "@/components/studio/SurfacePage";
import { OpenDesignStudio } from "@/components/studio/OpenDesignStudio";

export default function StudioPage() {
  return (
    <SurfacePage flag="studioOpen">
      <OpenDesignStudio />
    </SurfacePage>
  );
}
