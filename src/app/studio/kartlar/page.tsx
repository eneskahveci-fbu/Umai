"use client";

import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/kartlar — tek stüdyo kabuğu — Kartlar (aralıklı tekrar) açık başlar. */
export default function CardsPage() {
  return (
    <SurfacePage flag="cardsStudioOpen">
      <StudioHub />
    </SurfacePage>
  );
}
