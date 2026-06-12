import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asContent,
  asOptString,
  asRepoPath,
  asString,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface BatchBody {
  namespace?: unknown;
  repo?: unknown;
  branch?: unknown;
  message?: unknown;
  token?: unknown;
  files?: unknown;
}

function encodeProject(namespace: string, repo: string) {
  return encodeURIComponent(`${namespace}/${repo}`);
}

/* Birden çok dosyayı TEK atomik commit'te yazar (GitLab commits API + actions[]).
   Eskiden MultiCommitBar dosya-dosya sıralı commit'liyordu; bu hem yavaştı hem
   N ayrı commit üretiyordu. Burada her dosyanın var/yok durumu PARALEL kontrol
   edilir (create/update kararı), sonra tek commit atılır. */
export async function POST(req: NextRequest) {
  let namespace: string, repo: string, branch: string, message: string | undefined, token: string;
  let files: { path: string; content: string }[];
  try {
    const body = await readJson<BatchBody>(req);
    namespace = asString(body.namespace, "namespace", { min: 1, max: 200 });
    repo = asString(body.repo, "repo", { min: 1, max: 200 });
    branch = asBranch(body.branch);
    message = asOptString(body.message, "message", { max: 500 });
    token = asToken(body.token);
    if (!Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ error: "files boş" }, { status: 400 });
    }
    files = (body.files as { path: unknown; content: unknown }[]).map((f) => ({
      path: asRepoPath(f.path),
      content: asContent(f.content),
    }));
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const proj = encodeProject(namespace, repo);
  const headers: Record<string, string> = { "PRIVATE-TOKEN": token, "Content-Type": "application/json" };

  try {
    /* Dal var mı? (silinmiş dala yazma → net hata) */
    const branchRes = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/branches/${encodeURIComponent(branch)}`,
      { method: "HEAD", headers },
    );
    if (!branchRes.ok) {
      return NextResponse.json({ error: `Dal bulunamadı: ${branch}` }, { status: 404 });
    }
    /* Her dosyanın var olup olmadığını PARALEL kontrol et → create/update. */
    const exists = await Promise.all(
      files.map(async (f) => {
        const res = await fetch(
          `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodeURIComponent(f.path)}?ref=${encodeURIComponent(branch)}`,
          { method: "HEAD", headers },
        );
        return res.ok;
      }),
    );

    const actions = files.map((f, i) => ({
      action: exists[i] ? "update" : "create",
      file_path: f.path,
      content: f.content,
    }));

    const res = await fetch(`https://gitlab.com/api/v4/projects/${proj}/repository/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({ branch, commit_message: message || `Update ${files.length} dosya`, actions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { message?: string }).message || "GitLab commit hatası" },
        { status: res.status },
      );
    }
    const data = await res.json() as { id?: string; short_id?: string };
    return NextResponse.json({ sha: data.short_id || data.id });
  } catch (e) {
    return NextResponse.json({ error: `Ağ hatası: ${(e as Error).message}` }, { status: 502 });
  }
}
