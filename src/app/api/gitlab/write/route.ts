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

interface WriteBody {
  namespace?: unknown;
  repo?: unknown;
  branch?: unknown;
  path?: unknown;
  content?: unknown;
  message?: unknown;
  token?: unknown;
}

function encodeProject(namespace: string, repo: string) {
  return encodeURIComponent(`${namespace}/${repo}`);
}

export async function POST(req: NextRequest) {
  let namespace: string, repo: string, branch: string, path: string;
  let content: string, message: string | undefined, token: string;
  try {
    const body = await readJson<WriteBody>(req);
    namespace = asString(body.namespace, "namespace", { min: 1, max: 200 });
    repo = asString(body.repo, "repo", { min: 1, max: 200 });
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

  const proj = encodeProject(namespace, repo);
  const encodedPath = encodeURIComponent(path);
  const headers: Record<string, string> = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };

  try {
    // Mevcut dosyanın son commit SHA'sını al (güncelleme için gerekli)
    const getRes = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { headers },
    );

    const commitMessage = message || `Update ${path}`;
    const bodyData: Record<string, string> = {
      branch,
      content: Buffer.from(content, "utf-8").toString("base64"),
      encoding: "base64",
      commit_message: commitMessage,
    };

    const method = getRes.ok ? "PUT" : "POST";
    const putRes = await fetch(
      `https://gitlab.com/api/v4/projects/${proj}/repository/files/${encodedPath}`,
      { method, headers, body: JSON.stringify(bodyData) },
    );

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { message?: string }).message || "GitLab yazma hatası" },
        { status: putRes.status },
      );
    }

    const result = await putRes.json();
    return NextResponse.json({ branch: result.branch });
  } catch (e) {
    return NextResponse.json(
      { error: `Ağ hatası: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
