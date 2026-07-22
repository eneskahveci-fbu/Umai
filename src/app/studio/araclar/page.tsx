"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
   açılışta hangi aracın aktif olacağını belirler.

   BUG (düzeltildi): eskiden `useState(() => window.location.search'ten oku)`
   ile lazy-init yapılıyordu — /studio/kroki gibi eski bir rotadan `router.
   replace("/studio/araclar?tab=kroki")` ile gelindiğinde, bu bileşenin İLK
   render'ı bazen tarayıcı URL'i henüz güncellenmeden önce gerçekleşiyor,
   `window.location.search` boş okunup HER ZAMAN "anket"e (varsayılan) düşü-
   yordu — Kroki/Defter/Kartlar kartlarının hiçbiri doğru ekranı açmıyordu.
   `useSearchParams()` Next.js router'ın kendi reaktif state'i olduğundan bu
   yarış durumuna hiç girmiyor — her zaman GERÇEKTEN navigasyon edilen rotanın
   parametrelerini yansıtır. */
function ContentToolsInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "";
  const flag = TAB_FLAGS[tab] ?? "formsStudioOpen";
  return (
    <SurfacePage flag={flag}>
      <StudioHub />
    </SurfacePage>
  );
}

export default function ContentToolsPage() {
  return (
    <Suspense fallback={null}>
      <ContentToolsInner />
    </Suspense>
  );
}
