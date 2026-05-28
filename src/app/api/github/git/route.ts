import { NextRequest, NextResponse } from "next/server";
import {
  asBranch,
  asOwner,
  asRepo,
  asString,
  asToken,
  isValidationError,
  readJson,
} from "@/lib/validate";

export const runtime = "nodejs";

interface GitBody {
  action?: unknown;
  owner?: unknown;
  repo?: unknown;
  token?: unknown;
  title?: unknown;
  body?: unknown;
  head?: unknown;
  base?: unknown;
  branchName?: unknown;
  fromBranch?: unknown;
}

const ACTIONS = new Set(["branches", "create_pr", "create_branch"]);

export async function POST(req: NextRequest) {
  let body: GitBody;
  let owner: string, repo: string, token: string, action: string;
  try {
    body = await readJson<GitBody>(req);
    action = asString(body.action, "action", { max: 40 });
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
    }
    owner = asOwner(body.owner);
    repo = asRepo(body.repo);
    token = asToken(body.token);
  } catch (e) {
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "craft-ai-web",
  };

  try {
    if (action === "branches") {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`,
        { headers },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `GitHub hatası: ${detail.slice(0, 200)}` },
          { status: res.status },
        );
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        return NextResponse.json({ branches: [] });
      }
      return NextResponse.json({
        branches: data.map((b: { name: string }) => b.name),
      });
    }

    if (action === "create_pr") {
      const title = asString(body.title, "title", { max: 256 });
      const prBody = asString(body.body ?? "", "body", { min: 0, max: 65536 });
      const head = asBranch(body.head);
      const base = asBranch(body.base);

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ title, body: prBody, head, base }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: data.message || "PR oluşturma hatası" },
          { status: res.status },
        );
      }
      return NextResponse.json({ url: data.html_url, number: data.number });
    }

    if (action === "create_branch") {
      const branchName = asBranch(body.branchName);
      const fromBranch = asBranch(body.fromBranch);

      const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`,
        { headers },
      );
      const refData = await refRes.json().catch(() => ({}));
      const sha = refData.object?.sha;
      if (!refRes.ok || !sha) {
        return NextResponse.json(
          { error: refData.message || "Kaynak dal bulunamadı" },
          { status: refRes.status || 400 },
        );
      }

      const createRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
        },
      );
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        return NextResponse.json(
          { error: createData.message || "Dal oluşturma hatası" },
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
