"use client";

import { ImageStudio } from "@/components/ImageStudio";
import { SurfacePage } from "@/components/studio/SurfacePage";

/* /studio/gorsel — AI görsel üretimi gerçek rotası. */
export default function ImagePage() {
  return (
    <SurfacePage flag="imageStudioOpen">
      <ImageStudio />
    </SurfacePage>
  );
}
