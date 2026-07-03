"use client";

import { useEffect } from "react";
import { initNative } from "@/lib/native";
import { installErrorLog } from "@/lib/errorLog";

/* Native (iOS/Android) kabukta açılışta durum çubuğu + geri tuşu kurulumunu
   yapar. Web'de tamamen no-op — hiçbir görsel/işlevsel etki yok. */
export function NativeInit() {
  useEffect(() => { installErrorLog(); void initNative(); }, []);
  return null;
}
