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

interface WriteBody {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  path?: unknown;
  content?: unknown;
  message?: unknown;
  token?: unknown;
}

export async function POST(req: NextRequest) {
  let owner: string, repo: string, branch: string, path: string;
  let content: string, message: string | undefined, token: string;
  try {
    const body = await readJson<WriteBody>(req);
    owner = asOwner(body.owner);
    repo = asRepo(body.repo);
    branch = asBranch(body.branch);
    path = asRepoPath(body.path);
    content = asContent(body.content);
    message = asOptString(body.message, "message", { max: 500 });
    token = asToken(body.token);
  } catch (e) {
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "craft-ai-web",
  };

  try {
    // Mevcut dosyanın SHA'sını al (güncelleme için gerekli)
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { headers },
    );
    let sha: string | undefined;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const detail = await getRes.text().catch(() => "");
      return NextResponse.json(
        { error: `GitHub okuma hatası: ${detail.slice(0, 200)}` },
        { status: getRes.status },
      );
    }

    const body: Record<string, string> = {
      message: message || `Update ${path}`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
      { method: "PUT", headers, body: JSON.stringify(body) },
    );

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || "GitHub yazma hatası" },
        { status: putRes.status },
      );
    }

    const result = await putRes.json();
    return NextResponse.json({
      sha: result.commit?.sha,
      url: result.content?.html_url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Ağ hatası: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
