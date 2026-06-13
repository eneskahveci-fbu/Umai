import type { NextRequest } from "next/server";
import { isValidationError, readJson, ValidationError } from "@/lib/validate";
import { checkLimit } from "@/lib/rate-limit";
import { searchWeb } from "@/lib/webSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = checkLimit(req, "search", 30, 60_000);
  if (limited) {
    return Response.json(limited.body, {
      status: limited.status,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  let query: string;
  try {
    const body = await readJson<{ query?: unknown }>(req);
    if (typeof body.query !== "string") {
      throw new ValidationError("query: metin olmalı");
    }
    query = body.query.trim();
    if (query.length === 0) return Response.json({ results: [] });
    if (query.length > 256) {
      throw new ValidationError("query: çok uzun (>256)");
    }
  } catch (e) {
    if (isValidationError(e)) {
      return new Response(e.message, { status: e.status });
    }
    return new Response("Geçersiz istek", { status: 400 });
  }

  try {
    /* Çoklu backend + gerçek tarayıcı UA (DDG datacenter 403'üne karşı). */
    const results = await searchWeb(query);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
