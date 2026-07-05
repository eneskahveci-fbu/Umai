"use client";

import type { StudioDevice } from "@/lib/studioConstants";

/* Önizleme cihaz çerçevesi — web (sade kenarlık) veya telefon (bezel + çentik).
   iframe sandbox'lı; içerik genişliği cihaza göre, telefonlarda sabit en/boy. */
export function DeviceFrame({
  srcDoc,
  device,
  reloadKey,
}: {
  srcDoc: string;
  device: StudioDevice;
  reloadKey: number;
}) {
  const iframe = (
    <iframe
      key={reloadKey}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-modals"
      referrerPolicy="no-referrer"
      className="w-full h-full border-0 bg-white"
      title="Stüdyo önizleme"
    />
  );

  if (!device.phone) {
    /* Web: cihaz genişliğinde, ortalanmış, kart görünümlü çerçeve. */
    return (
      <div className="w-full h-full overflow-auto grid place-items-start justify-center p-4 sm:p-6">
        <div
          className="bg-white rounded-xl overflow-hidden shadow-2xl border border-line/40"
          style={{ width: "100%", maxWidth: device.width, height: "100%", minHeight: 420 }}
        >
          {iframe}
        </div>
      </div>
    );
  }

  /* Telefon: bezel + çentik, sabit en/boy; alan küçükse ölçeklenir (CSS). */
  return (
    <div className="w-full h-full overflow-auto grid place-items-center p-4 sm:p-6">
      <div
        className="relative shrink-0 rounded-[2.2rem] bg-codebg border-[10px] border-codebg shadow-2xl ring-1 ring-line/40"
        style={{ width: device.width, height: device.height ?? 844 }}
      >
        {/* Çentik */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-codebg rounded-b-2xl z-10" />
        <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-white">
          {iframe}
        </div>
      </div>
    </div>
  );
}
