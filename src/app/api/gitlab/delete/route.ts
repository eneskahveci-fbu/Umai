import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asOptString,
  asRepoPath,
  asString,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface DeleteBody {
  namespace?: unknown;
  repo?: unknown;
  branch?: unknown;
  path?: unknown;
  message?: unknown;
  token?: unknown;
}

function encodeProject(namespace: string, repo: string) {
  return encodeURIComponent(`${namespace}/${repo}`);
}

/* Bir dosyayı siler + commit eder. Yalnızca KULLANICI ONAYINDAN sonra çağrılır. */
export async function POST(req: NextRequest) {
  let namespace: string, repo: string, branch: string, path: string;
  let message: string | undefined, token: string;
  try {
    const body = await readJson<DeleteBody>(req);
    namespace = asString(body.namespace, "namespace", { min: 1, max: 200 });
    repo = asString(body.repo, "repo", { min: 1, max: 200 });
    branch = asBranch(body.branch);
    path = asRepoPath(body.path);
    message = asOptString(body.message, "message", { max: 500 });
    token = asToken(body.token);
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const proj = encodeProject(namespace, repo);
  const encodedPath = encodeURIComponent(path);
  const headers: Record<string, string> = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };

  try {
    const delRes = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodedPath}`,
      {
        method: "DELETE",
        headers,
        body: JSON.stringify({ branch, commit_message: message || `Delete ${path}` }),
      },
    );
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { message?: string }).message || "GitLab silme hatası" },
        { status: delRes.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Ağ hatası: ${(e as Error).message}` }, { status: 502 });
  }
}
