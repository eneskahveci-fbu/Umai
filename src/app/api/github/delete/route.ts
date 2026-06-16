import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asOwner,
  asOptString,
  asRepo,
  asRepoPath,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface DeleteBody {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  path?: unknown;
  message?: unknown;
  token?: unknown;
}

/* Bir dosyayı siler + commit eder. Yalnızca KULLANICI ONAYINDAN sonra
   istemciden çağrılır (ajan doğrudan silemez). */
export async function POST(req: NextRequest) {
  const __rl = rateLimit(req, "gh-delete", 20, 60_000);
  if (__rl) return __rl;
  let owner: string, repo: string, branch: string, path: string;
  let message: string | undefined, token: string;
  try {
    const body = await readJson<DeleteBody>(req);
    owner = asOwner(body.owner);
    repo = asRepo(body.repo);
    branch = asBranch(body.branch);
    path = asRepoPath(body.path);
    message = asOptString(body.message, "message", { max: 500 });
    token = asToken(body.token);
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

  try {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    // Silme için mevcut SHA gerekli
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { headers },
    );
    if (!getRes.ok) {
      const detail = await getRes.text().catch(() => "");
      return NextResponse.json(
        { error: getRes.status === 404 ? `Dosya bulunamadı: ${path}` : `GitHub okuma hatası: ${detail.slice(0, 200)}` },
        { status: getRes.status },
      );
    }
    const { sha } = (await getRes.json()) as { sha?: string };
    if (!sha) return NextResponse.json({ error: "Dosya SHA alınamadı" }, { status: 500 });

    const delRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
      {
        method: "DELETE",
        headers,
        body: JSON.stringify({ message: message || `Delete ${path}`, sha, branch }),
      },
    );
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      return NextResponse.json({ error: err.message || "GitHub silme hatası" }, { status: delRes.status });
    }
    const result = await delRes.json();
    return NextResponse.json({ sha: result.commit?.sha });
  } catch (e) {
    return NextResponse.json({ error: `Ağ hatası: ${(e as Error).message}` }, { status: 502 });
  }
}
