import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asString,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface GitBody {
  action?: unknown;
  namespace?: unknown;
  repo?: unknown;
  token?: unknown;
  title?: unknown;
  description?: unknown;
  sourceBranch?: unknown;
  targetBranch?: unknown;
  branchName?: unknown;
  fromBranch?: unknown;
}

const ACTIONS = new Set(["branches", "create_mr", "create_branch"]);

function encodeProject(namespace: string, repo: string) {
  return encodeURIComponent(`${namespace}/${repo}`);
}

export async function POST(req: NextRequest) {
  const __rl = rateLimit(req, "gl-git", 60, 60_000);
  if (__rl) return __rl;
  let body: GitBody;
  let namespace: string, repo: string, token: string, action: string;
  try {
    body = await readJson<GitBody>(req);
    action = asString(body.action, "action", { max: 40 });
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
    }
    namespace = asString(body.namespace, "namespace", { min: 1, max: 200 });
    repo = asString(body.repo, "repo", { min: 1, max: 200 });
    token = asToken(body.token);
  } catch (e) {
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const proj = encodeProject(namespace, repo);
  const headers = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };

  try {
    if (action === "branches") {
      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${proj}/repository/branches?per_page=30`,
        { headers },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `GitLab hatası: ${detail.slice(0, 200)}` },
          { status: res.status },
        );
      }
      const data = await res.json();
      return NextResponse.json({
        branches: Array.isArray(data) ? data.map((b: { name: string }) => b.name) : [],
      });
    }

    if (action === "create_mr") {
      const title = asString(body.title, "title", { max: 256 });
      const description = asString(body.description ?? "", "description", { min: 0, max: 65536 });
      const sourceBranch = asBranch(body.sourceBranch);
      const targetBranch = asBranch(body.targetBranch);

      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${proj}/merge_requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ title, description, source_branch: sourceBranch, target_branch: targetBranch }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: (data as { message?: string }).message || "MR oluşturma hatası" },
          { status: res.status },
        );
      }
      return NextResponse.json({ url: (data as { web_url?: string }).web_url, iid: (data as { iid?: number }).iid });
    }

    if (action === "create_branch") {
      const branchName = asBranch(body.branchName);
      const fromBranch = asBranch(body.fromBranch);

      const createRes = await fetch(
        `https://gitlab.com/api/v4/projects/${proj}/repository/branches`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ branch: branchName, ref: fromBranch }),
        },
      );
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        return NextResponse.json(
          { error: (createData as { message?: string }).message || "Dal oluşturma hatası" },
          { status: createRes.status },
        );
      }
      return NextResponse.json({ branch: branchName });
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (e) {
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: `Ağ hatası: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
