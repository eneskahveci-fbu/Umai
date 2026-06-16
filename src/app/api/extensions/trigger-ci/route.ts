import { rateLimit } from "@/lib/rate-limit";
// ---------------------------------------------------------------------------
// POST /api/extensions/trigger-ci
// GitHub Actions workflow_dispatch ile CI tetikleme.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TriggerRequest {
  workflow: string;
  owner: string;
  repo: string;
  token?: string;
  ref?: string;
  inputs?: Record<string, string>;
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "trigger-ci", 15, 60_000);
  if (__rl) return __rl;
  try {
    const body = (await req.json().catch(() => ({}))) as TriggerRequest;
    const { workflow, owner, repo, token, ref, inputs } = body;

    if (!owner || !repo || !workflow) {
      return NextResponse.json(
        { error: "owner, repo ve workflow parametreleri zorunludur." },
        { status: 400 },
      );
    }

    const branch = ref || "main";

    // workflow_dispatch endpoint'i
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

    const payload: Record<string, unknown> = { ref: branch };
    if (inputs && Object.keys(inputs).length > 0) {
      payload.inputs = inputs;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...ghHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 204) {
      return NextResponse.json({
        success: true,
        message: `"${workflow}" workflow'u "${branch}" dalında tetiklendi. GitHub Actions sekmesinden durumu takip edebilirsiniz.`,
        url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions`,
      });
    }

    // 404 = workflow bulunamadı
    if (res.status === 404) {
      return NextResponse.json(
        {
          error: `"${workflow}" workflow'u bulunamadı. Workflow dosya adını kontrol edin.`,
          hint: "Workflow dosyası .github/workflows/ altında olmalı ve workflow_dispatch event'ini içermeli.",
        },
        { status: 404 },
      );
    }

    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `GitHub API hatası: ${res.status} — ${text.slice(0, 300)}` },
      { status: res.status },
    );
  } catch (e) {
    return NextResponse.json(
      { error: `CI tetiklenemedi: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
