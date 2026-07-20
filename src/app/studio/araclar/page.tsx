"use client";

import { useState } from "react";
import { StudioHub } from "@/components/studio/StudioHub";
import { SurfacePage, type SurfaceFlag } from "@/components/studio/SurfacePage";

const TAB_FLAGS: Record<string, SurfaceFlag> = {
  anket: "formsStudioOpen",
  defter: "notebookStudioOpen",
  kroki: "mapStudioOpen",
  kartlar: "cardsStudioOpen",
};

/* /studio/araclar — Anket/Defter/Kroki/Kartlar'ın BİRLEŞİK sayfası (Tem 2026
   kullanıcı kararı: "özellik kaybetmeden birleştir"). StudioHub zaten bu 4
   aracı (+ Doküman) TEK bir sekme çubuğunda gösteriyordu — tek eksik, her
   aracın kendi rotası olduğundan sekmeler arası geçiş tam sayfa yeniden
   mount'a (router.push) neden oluyordu. Artık hepsi bu TEK rotada; sekme
   değişimi surfaceNav.go()'nun "aynı sayfadaysa yalnız bayrak değiştir"
   dalıyla anında, yeniden mount olmadan gerçekleşiyor. ?tab= yalnız İLK
   açılışta hangi aracın aktif olacağını belirler (login/page.tsx'teki
   safeNext ile aynı desen: window.location.search'ten lazy-init, Suspense
   gerektiren useSearchParams yerine); StudioHub içindeki sekmeler arası
   geçiş bundan sonra URL'e dokunmaz. */
export default function ContentToolsPage() {
  const [flag] = useState<SurfaceFlag>(() => {
    if (typeof window === "undefined") return "formsStudioOpen";
    const tab = new URLSearchParams(window.location.search).get("tab") ?? "";
    return TAB_FLAGS[tab] ?? "formsStudioOpen";
  });
  return (
    <SurfacePage flag={flag}>
      <StudioHub />
    </SurfacePage>
  );
}
