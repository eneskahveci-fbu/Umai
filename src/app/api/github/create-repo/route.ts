import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { asOptString, asRepo, asToken, isValidationError, readJson } from "@/lib/validate";

export const runtime = "nodejs";

/* ── Yeni GitHub deposu oluştur ──────────────────────────────────────────────
   Lovable/Replit döngüsünün kopuk halkası buydu: kullanıcı önizlemede sıfırdan
   bir şey üretebiliyor ama onu YENİ bir depoya gönderemiyordu — ajan yalnız
   zaten bağlı bir depoya yazabiliyor, `create_repo` diye bir araç yoktu.

   İki teknik ayrıntı:
   1) `auto_init: true` ŞART. Mevcut batch-write ucu ilk adımda dalın HEAD
      referansını okuyor; boş bir depoda hiç ref yoktur ve orada çöker. İlk
      commit'i GitHub'a attırınca batch-write olduğu gibi yeniden kullanılır.
   2) auto_init'in commit'i anında görünmeyebiliyor. Bu uç, dal referansı
      gerçekten okunabilir olana kadar kısa bir süre bekler; aksi hâlde hemen
      ardından gelen batch-write yarışı kaybedip "Branch ref alınamadı" derdi. */

interface Body { token?: unknown; name?: unknown; description?: unknown; isPrivate?: unknown }

const GH = "https://api.github.com";
const REF_RETRIES = 8;
const REF_DELAY_MS = 400;

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "gh-create-repo", 10, 60_000);
  if (rl) return rl;

  let token: string, name: string, description: string | undefined, isPrivate: boolean;
  try {
    const body = await readJson<Body>(req);
    token = asToken(body.token);
    name = asRepo(body.name);
    description = asOptString(body.description, "description", { max: 350 });
    isPrivate = body.isPrivate === true;
  } catch (e) {
    if (isValidationError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "craft-ai-web",
  };

  try {
    const createRes = await fetch(`${GH}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, description: description ?? "", private: isPrivate, auto_init: true }),
    });

    if (createRes.status === 422) {
      /* GitHub'ın 422'si iki şey olabilir: ad zaten var ya da ad geçersiz.
         Ham gövdeyi göstermek yerine en olası nedeni söyle. */
      const t = await createRes.text().catch(() => "");
      const exists = /already exists/i.test(t);
      return NextResponse.json(
        { error: exists ? `"${name}" adında bir depon zaten var — başka bir ad seç.` : `GitHub adı kabul etmedi: ${t.slice(0, 160)}` },
        { status: 409 },
      );
    }
    if (createRes.status === 401 || createRes.status === 403) {
      return NextResponse.json(
        { error: "GitHub erişim anahtarı depo oluşturmaya yetkili değil. Ayarlar → Git'ten `repo` kapsamlı bir token ile yeniden bağla." },
        { status: 403 },
      );
    }
    if (!createRes.ok) {
      const t = await createRes.text().catch(() => "");
      return NextResponse.json({ error: `Depo oluşturulamadı (${createRes.status}): ${t.slice(0, 160)}` }, { status: 502 });
    }

    const repo = await createRes.json();
    const owner: string = repo.owner?.login;
    const defaultBranch: string = repo.default_branch || "main";
    if (!owner) return NextResponse.json({ error: "GitHub depo sahibini döndürmedi." }, { status: 502 });

    /* auto_init commit'i görünene kadar bekle. */
    const refUrl = `${GH}/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(defaultBranch)}`;
    let ready = false;
    for (let i = 0; i < REF_RETRIES && !ready; i++) {
      const r = await fetch(refUrl, { headers });
      if (r.ok) { ready = true; break; }
      await new Promise((res) => setTimeout(res, REF_DELAY_MS));
    }

    return NextResponse.json({
      owner,
      repo: name,
      defaultBranch,
      htmlUrl: repo.html_url as string,
      /* Hazır değilse istemci yine de dener; batch-write'ın kendi hatası
         anlaşılır bir mesaj verir. Sessizce gizlenmez. */
      ready,
    });
  } catch (e) {
    return NextResponse.json({ error: `Hata: ${(e as Error).message}` }, { status: 502 });
  }
}
