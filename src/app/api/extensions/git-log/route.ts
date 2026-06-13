// ---------------------------------------------------------------------------
// POST /api/extensions/git-log
// GitHub Commits API üzerinden commit geçmişini döndürür.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LogRequest {
  owner: string;
  repo: string;
  token?: string;
  branch?: string;
  path?: string;
  limit?: number;
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as LogRequest;
    const { owner, repo, token, branch, path, limit } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner ve repo parametreleri zorunludur." },
        { status: 400 },
      );
    }

    const params = new URLSearchParams();
    const perPage = Math.min(Math.max(limit || 10, 1), 30);
    params.set("per_page", String(perPage));
    if (branch) params.set("sha", branch);
    if (path) params.set("path", path);

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`;

    const res = await fetch(url, { headers: ghHeaders(token) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `GitHub API hatası: ${res.status} — ${text.slice(0, 300)}` },
        { status: res.status },
      );
    }

    const data = await res.json() as Array<{
      sha: string;
      html_url: string;
      commit: {
        author: { name: string; date: string };
        message: string;
      };
    }>;

    const commits = data.map((c) => ({
      sha: c.sha.slice(0, 7),
      url: c.html_url,
      author: c.commit.author?.name || "bilinmiyor",
      date: c.commit.author?.date || "",
      message: c.commit.message.split("\n")[0]?.slice(0, 120) || "",
    }));

    return NextResponse.json({ commits, total: commits.length });
  } catch (e) {
    return NextResponse.json(
      { error: `Git log alınamadı: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
