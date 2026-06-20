"use client";

import { useEffect } from "react";
import { initNative } from "@/lib/native";

/* Native (iOS/Android) kabukta açılışta durum çubuğu + geri tuşu kurulumunu
   yapar. Web'de tamamen no-op — hiçbir görsel/işlevsel etki yok. */
export function NativeInit() {
  useEffect(() => { void initNative(); }, []);
  return null;
}
