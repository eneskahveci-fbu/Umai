export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query) return Response.json({ results: [] });

  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            `Mozilla/5.0 (compatible; craft.ai/1.0; +${process.env.NEXT_PUBLIC_SITE_URL ?? "https://craft-coder.vercel.app"})`,
        },
      },
    );
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
          title,
          snippet,
          url: urlMatch?.[1] || "",
        });
      }
    }

    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
