import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asContent,
  asOwner,
  asOptString,
  asRepo,
  asRepoPath,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface BatchFile { path: unknown; content: unknown }
interface BatchBody {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  message?: unknown;
  token?: unknown;
  files?: unknown;
}

const MAX_FILES = 50;

export async function POST(req: NextRequest) {
  const __rl = rateLimit(req, "gh-batch", 20, 60_000);
  if (__rl) return __rl;
  let owner: string, repo: string, branch: string, token: string;
  let message: string | undefined;
  let files: { path: string; content: string }[];
  try {
    const body = await readJson<BatchBody>(req);
    owner = asOwner(body.owner);
    repo = asRepo(body.repo);
    branch = asBranch(body.branch);
    token = asToken(body.token);
    message = asOptString(body.message, "message", { max: 500 });
    if (!Array.isArray(body.files) || body.files.length === 0)
      return NextResponse.json({ error: "files boş olamaz" }, { status: 400 });
    if (body.files.length > MAX_FILES)
      return NextResponse.json({ error: `En fazla ${MAX_FILES} dosya` }, { status: 400 });
    files = body.files.map((f: BatchFile) => ({
      path: asRepoPath(f.path),
      content: asContent(f.content),
    }));
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "craft-ai-web",
  };
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const enc = encodeURIComponent;

  try {
    /* 1) HEAD commit + tree SHA */
    const refRes = await fetch(`${base}/git/refs/heads/${enc(branch)}`, { headers });
    if (!refRes.ok) {
      const t = await refRes.text().catch(() => "");
      return NextResponse.json({ error: `Branch ref alınamadı: ${t.slice(0, 200)}` }, { status: refRes.status });
    }
    const ref = await refRes.json();
    const headCommitSha = ref.object.sha;

    const commitRes = await fetch(`${base}/git/commits/${headCommitSha}`, { headers });
    if (!commitRes.ok) {
      const t = await commitRes.text().catch(() => "");
      return NextResponse.json({ error: `Commit alınamadı: ${t.slice(0, 200)}` }, { status: commitRes.status });
    }
    const headCommit = await commitRes.json();
    const baseTreeSha = headCommit.tree.sha;

    /* 2) Her dosya için blob oluştur */
    const blobs = await Promise.all(files.map(async (f) => {
      const r = await fetch(`${base}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: Buffer.from(f.content, "utf-8").toString("base64"),
          encoding: "base64",
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Blob oluşturulamadı (${f.path}): ${t.slice(0, 150)}`);
      }
      const j = await r.json();
      return { path: f.path, sha: j.sha };
    }));

    /* 3) Yeni tree (base_tree'nin üzerine) */
    const treeRes = await fetch(`${base}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
      }),
    });
    if (!treeRes.ok) {
      const t = await treeRes.text().catch(() => "");
      return NextResponse.json({ error: `Tree oluşturulamadı: ${t.slice(0, 200)}` }, { status: treeRes.status });
    }
    const newTree = await treeRes.json();

    /* 4) Yeni commit */
    const newCommitRes = await fetch(`${base}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: message || `Update ${files.length} files`,
        tree: newTree.sha,
        parents: [headCommitSha],
      }),
    });
    if (!newCommitRes.ok) {
      const t = await newCommitRes.text().catch(() => "");
      return NextResponse.json({ error: `Commit oluşturulamadı: ${t.slice(0, 200)}` }, { status: newCommitRes.status });
    }
    const newCommit = await newCommitRes.json();

    /* 5) Branch ref'i güncelle */
    const updateRes = await fetch(`${base}/git/refs/heads/${enc(branch)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updateRes.ok) {
      const t = await updateRes.text().catch(() => "");
      return NextResponse.json({ error: `Ref güncellenemedi: ${t.slice(0, 200)}` }, { status: updateRes.status });
    }

    return NextResponse.json({
      sha: newCommit.sha,
      url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
      files: files.length,
    });
  } catch (e) {
    return NextResponse.json({ error: `Hata: ${(e as Error).message}` }, { status: 502 });
  }
}
