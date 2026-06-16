import { rateLimit } from "@/lib/rate-limit";
// ---------------------------------------------------------------------------
// POST /api/extensions/discover-rules
// Bağlı repodaki CLAUDE.md, AGENTS.md, .rules, .cursorrules vb. dosyaları
// otomatik keşfeder ve içeriklerini döndürür.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { discoverContextFiles, formatDiscoveredAsPrompt } from "@/lib/extensions/contextDiscovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DiscoverRequest {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  provider?: "github" | "gitlab";
  /** Önceden getirilmiş tüm dosya yolları (opsiyonel — yoksa endpoint kendi çeker) */
  allPaths?: string[];
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function glHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["PRIVATE-TOKEN"] = token;
  return h;
}

async function fetchGitHubFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) return "";
  const data = await res.json() as { content?: string; encoding?: string };
  if (data.content && data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return "";
}

async function fetchAllPathsGitHub(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<string[]> {
  // Git tree API (recursive) ile tüm dosyaları al
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`Ağaç alınamadı: ${res.status}`);
  const data = await res.json() as { tree?: Array<{ type: string; path: string }> };
  return (data.tree || []).filter((n) => n.type === "blob").map((n) => n.path);
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "discover-rules", 30, 60_000);
  if (__rl) return __rl;
  try {
    const body = (await req.json().catch(() => ({}))) as DiscoverRequest;
    const { owner, repo, branch, token, provider, allPaths } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner ve repo parametreleri zorunludur." },
        { status: 400 },
      );
    }

    const isGitLab = provider === "gitlab";

    // 1) Tüm dosya yollarını al (önceden verilmediyse)
    let paths: string[];
    if (allPaths && allPaths.length > 0) {
      paths = allPaths;
    } else if (isGitLab) {
      // GitLab için recursive tree
      const glProj = encodeURIComponent(`${owner}/${repo}`);
      const glUrl = `https://gitlab.com/api/v4/projects/${glProj}/repository/tree?recursive=true&ref=${encodeURIComponent(branch || "main")}&per_page=100`;
      const glRes = await fetch(glUrl, { headers: glHeaders(token) });
      if (!glRes.ok) {
        return NextResponse.json(
          { error: `GitLab ağacı alınamadı: ${glRes.status}` },
          { status: glRes.status },
        );
      }
      const glData = await glRes.json() as Array<{ type: string; path: string }>;
      paths = glData.filter((n) => n.type === "blob").map((n) => n.path);
    } else {
      paths = await fetchAllPathsGitHub(owner, repo, branch || "main", token);
    }

    // 2) Keşfet
    const fetchFn = async (path: string): Promise<string> => {
      if (isGitLab) {
        return ""; // GitLab için şimdilik basit geç
      }
      return fetchGitHubFile(owner, repo, branch || "main", path, token);
    };

    const discovered = await discoverContextFiles(paths, fetchFn);

    // 3) Format
    const promptSnippet = formatDiscoveredAsPrompt(discovered);

    return NextResponse.json({
      files: discovered.map((d) => ({ path: d.path, matchedPattern: d.matchedPattern })),
      contents: discovered.map((d) => ({ path: d.path, content: d.content.slice(0, 4000) })),
      combinedPrompt: promptSnippet.slice(0, 8000),
      totalFound: discovered.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Keşif başarısız: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
