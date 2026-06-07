import type { NextRequest } from "next/server";
import { isValidationError, readJson, ValidationError } from "@/lib/validate";
import { checkLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

const SEARCH_TIMEOUT_MS = 8_000;

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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        signal: ctrl.signal,
        headers: {
          "User-Agent": `Mozilla/5.0 (compatible; Craft.Coder/1.0; +${
            process.env.NEXT_PUBLIC_SITE_URL || "https://craft-ai-web.vercel.app"
          })`,
        },
      },
    );
    if (!res.ok) return Response.json({ results: [] });
    const html = await res.text();
    const results: SearchResult[] = [];

    const blocks = html.split("result__body");
    for (const block of blocks.slice(1, 6)) {
      const titleMatch = block.match(
        /class="result__a"[^>]*>([\s\S]*?)<\/a>/,
      );
      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/,
      );
      const urlMatch = block.match(
        /class="result__url"[^>]*href="([^"]*)"[^>]*>/,
      );

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim();
      const snippet = snippetMatch?.[1]?.replace(/<[^>]+>/g, "").trim();

      if (title && snippet) {
        results.push({
          title: title.slice(0, 200),
          snippet: snippet.slice(0, 400),
          url: urlMatch?.[1]?.slice(0, 2048) || "",
        });
      }
    }

    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  } finally {
    clearTimeout(timer);
  }
}
