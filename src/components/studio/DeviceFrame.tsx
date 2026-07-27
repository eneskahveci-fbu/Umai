"use client";

import type { ReactNode } from "react";
import type { StudioDevice } from "@/lib/studioConstants";

/* Önizleme cihaz çerçevesi — web (sade kart) veya telefon (bezel + çentik).

   U5 — Bu bileşen yazılmıştı ama HİÇBİR YERDEN import edilmiyordu (ölü kod):
   tasarım stüdyosunda responsive önizleme yoktu. Bağlanırken kendi iframe'ini
   kurmaktan vazgeçti ve bir SARMALAYICI'ya dönüştü: iframe'i çağıran verir.
   Sebep somut — ArtifactCanvas kendi iframe'i üzerinde ref (İşaretle & Değiştir
   postMessage doğrulaması) ve key (sürüm/yeniden yükleme) denetimi tutuyor;
   burada ikinci bir iframe kurmak o mekanizmayı koparırdı. */
export function DeviceFrame({
  device,
  children,
}: {
  device: StudioDevice;
  /** Önizleme iframe'i — çağıran kurar (ref/key/sandbox onun denetiminde). */
  children: ReactNode;
}) {
  if (!device.phone) {
    /* Web: cihaz genişliğinde, ortalanmış, kart görünümlü çerçeve. */
    return (
      <div className="w-full h-full overflow-auto grid place-items-start justify-center p-4 sm:p-6 bg-bgsoft/40">
        <div
          className="bg-white rounded-xl overflow-hidden shadow-2xl border border-line/40"
          style={{ width: "100%", maxWidth: device.width, height: "100%", minHeight: 420 }}
        >
          {children}
        </div>
      </div>
    );
  }

  /* Telefon: bezel + çentik, sabit en/boy. */
  return (
    <div className="w-full h-full overflow-auto grid place-items-center p-4 sm:p-6 bg-bgsoft/40">
      <div
        className="relative shrink-0 rounded-[2.2rem] bg-codebg border-[10px] border-codebg shadow-2xl ring-1 ring-line/40"
        style={{ width: device.width, height: device.height ?? 844 }}
      >
        {/* Çentik */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-codebg rounded-b-2xl z-10" />
        <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}
