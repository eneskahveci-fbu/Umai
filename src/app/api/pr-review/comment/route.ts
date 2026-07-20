import { rateLimit } from "@/lib/rate-limit";
import { parseBody, prCommentSchema } from "@/lib/apiSchemas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* PR/MR incelemesini (bkz. ../route.ts'in okuduğu diff'ten üretilen sohbet
   yanıtı) GERÇEK bir yorum olarak GitHub/GitLab'a geri yazar. Önceden bu uç
   yoktu — inceleme yalnız sohbette kalıyordu, kullanıcı manuel kopyala-
   yapıştır yapmak zorundaydı. */

interface PrCommentRequest {
  provider: "github" | "gitlab";
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  body: string;
}

/* GitHub'da PR'lar da birer "issue" — issue-yorum uç noktası PR'a da yazar
   (satıra-bağlı review-comment değil, genel bir PR yorumu; basit ve yeterli). */
async function postGithubComment(owner: string, repo: string, prNumber: number, token: string, body: string): Promise<void> {
  /* owner/repo kaçırılmadan URL'ye gömülüyordu — bkz. ../route.ts'teki aynı
     düzeltme: schema karakter kümesini kısıtlamadığından "/.." içeren bir
     owner, URL normalizasyonuyla isteği api.github.com'un başka bir uç
     noktasına yönlendirebilirdi. */
  const o = encodeURIComponent(owner);
  const r = encodeURIComponent(repo);
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "umai-web",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub yorum gönderilemedi: ${res.status}`);
}

async function postGitlabComment(owner: string, repo: string, mrNumber: number, token: string, body: string): Promise<void> {
  const project = encodeURIComponent(`${owner}/${repo}`);
  const res = await fetch(`https://gitlab.com/api/v4/projects/${project}/merge_requests/${mrNumber}/notes`, {
    method: "POST",
    headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitLab yorum gönderilemedi: ${res.status}`);
}

export async function POST(req: Request) {
  const __rl = rateLimit(req, "pr-review-comment", 5, 60_000);
  if (__rl) return __rl;
  const __v = await parseBody(req, prCommentSchema);
  if (!__v.ok) return __v.res;
  const body = __v.data as PrCommentRequest;
  try {
    if (body.provider === "github") {
      await postGithubComment(body.owner, body.repo, body.prNumber, body.token, body.body);
    } else {
      await postGitlabComment(body.owner, body.repo, body.prNumber, body.token, body.body);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
