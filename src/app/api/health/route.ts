import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Canlılık ucu — izleme, Capacitor uygulaması ve dağıtım doğrulaması için.
   Kimlik/veri içermez; her zaman hızlı döner. */
export async function GET() {
  return NextResponse.json(
    { ok: true, version: pkg.version, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
