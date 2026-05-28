import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { action, owner, repo, token, ...params } = await req.json();
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    if (action === "branches") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`, { headers });
      const data = await res.json();
      return NextResponse.json({ branches: data.map((b: { name: string }) => b.name) });
    }

    if (action === "create_pr") {
      const { title, body, head, base } = params;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: "POST", headers,
        body: JSON.stringify({ title, body, head, base }),
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
      return NextResponse.json({ url: data.html_url, number: data.number });
    }

    if (action === "create_branch") {
      const { branchName, fromBranch } = params;
      // Get SHA of fromBranch
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, { headers });
      const refData = await refRes.json();
      const sha = refData.object?.sha;
      if (!sha) return NextResponse.json({ error: "Dal bulunamadı" }, { status: 400 });

      const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST", headers,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) return NextResponse.json({ error: createData.message }, { status: createRes.status });
      return NextResponse.json({ branch: branchName });
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
