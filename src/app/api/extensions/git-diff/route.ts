// ---------------------------------------------------------------------------
// POST /api/extensions/git-diff
// GitHub Compare API üzerinden iki commit/dal arasındaki farkı döndürür.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DiffRequest {
  base: string;
  head: string;
  owner: string;
  repo: string;
  token?: string;
}

async function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.diff",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DiffRequest;
    const { base, head, owner, repo, token } = body;

    if (!base || !head) {
      return NextResponse.json(
        { error: "base ve head parametreleri zorunludur." },
        { status: 400 },
      );
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner ve repo parametreleri zorunludur." },
        { status: 400 },
      );
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;

    const res = await fetch(url, { headers: ghHeaders(token) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `GitHub API hatası: ${res.status} — ${text.slice(0, 300)}` },
        { status: res.status },
      );
    }

    // GitHub Compare API diff formatında döner (Accept: diff)
    const diffText = await res.text();

    if (!diffText.trim()) {
      return NextResponse.json({
        result: "Bu iki referans arasında fark yok — aynı commit veya içerik.",
        filesChanged: 0,
      });
    }

    // Basit istatistik çıkarma
    const fileCount = (diffText.match(/^diff --git/gm) || []).length;
    const additions = (diffText.match(/^\+[^+]/gm) || []).length;
    const deletions = (diffText.match(/^-[^-]/gm) || []).length;

    return NextResponse.json({
      result: diffText.slice(0, 12_000), // Çok büyük diff'leri kırp
      truncated: diffText.length > 12_000,
      filesChanged: fileCount,
      additions,
      deletions,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Git diff alınamadı: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
