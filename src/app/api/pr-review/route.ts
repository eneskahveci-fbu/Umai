import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PrReviewRequest {
  provider: "github" | "gitlab";
  owner: string;
  repo: string;
  prNumber: number;
  token?: string;
}

async function fetchGithubPrDiff(owner: string, repo: string, prNumber: number, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.diff" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
  if (!res.ok) throw new Error(`GitHub PR fetch failed: ${res.status}`);
  return res.text();
}

async function fetchGitlabMrDiff(owner: string, repo: string, mrNumber: number, token?: string): Promise<string> {
  const project = encodeURIComponent(`${owner}/${repo}`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["PRIVATE-TOKEN"] = token;
  const res = await fetch(`https://gitlab.com/api/v4/projects/${project}/merge_requests/${mrNumber}/changes`, { headers });
  if (!res.ok) throw new Error(`GitLab MR fetch failed: ${res.status}`);
  const data = await res.json() as { changes?: { diff: string; new_path: string }[] };
  return (data.changes ?? []).map((c) => `--- ${c.new_path}\n${c.diff}`).join("\n\n");
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "pr-review", 10, 60_000);
  if (__rl) return __rl;
  try {
    const body = await req.json() as PrReviewRequest;
    let diff = "";
    if (body.provider === "github") {
      diff = await fetchGithubPrDiff(body.owner, body.repo, body.prNumber, body.token);
    } else {
      diff = await fetchGitlabMrDiff(body.owner, body.repo, body.prNumber, body.token);
    }
    if (!diff.trim()) return Response.json({ error: "No diff found" }, { status: 404 });
    return Response.json({ diff: diff.slice(0, 50_000) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
