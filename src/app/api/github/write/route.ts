import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch, path, content, message, token } = await req.json();
    if (!owner || !repo || !path || content === undefined || !token) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Get current file SHA (required for updates)
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers }
    );
    let sha: string | undefined;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }

    // Create or update file
    const body: Record<string, string> = {
      message: message || `Update ${path}`,
      content: Buffer.from(content).toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { method: "PUT", headers, body: JSON.stringify(body) }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return NextResponse.json({ error: err.message || "GitHub hatası" }, { status: putRes.status });
    }

    const result = await putRes.json();
    return NextResponse.json({ sha: result.commit?.sha, url: result.content?.html_url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
