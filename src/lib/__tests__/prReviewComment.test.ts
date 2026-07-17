import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/pr-review/comment/route";

/* Yeni /api/pr-review/comment ucu — PR incelemesini (önceden yalnız sohbette
   kalan) GERÇEK bir yorum olarak GitHub/GitLab'a geri yazar. Canlı sunucu bu
   sandboxta kararsız olduğundan (arka plan süreç yönetimi), route handler'ı
   doğrudan içe aktarıp `fetch`i mockluyoruz — gerçek ağ isteği/kimlik bilgisi
   gerekmeden isteğin doğru URL/başlık/gövdeyle kurulduğunu ve yanıtın doğru
   şekillendirildiğini doğrular. Her test kendi x-forwarded-for'unu kullanır ki
   modül-seviyeli rate-limit bucket'ı testler arasında çakışmasın. */

function req(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/pr-review/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/pr-review/comment", () => {
  it("token eksikse 400 döner, fetch hiç çağrılmaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ provider: "github", owner: "a", repo: "b", prNumber: 1, body: "yorum" }, "1.1.1.1"));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("body eksikse 400 döner", async () => {
    const res = await POST(req({ provider: "github", owner: "a", repo: "b", prNumber: 1, token: "T" }, "1.1.1.2"));
    expect(res.status).toBe(400);
  });

  it("GitHub: doğru issue-yorum uç noktasına, doğru başlık/gövdeyle POST eder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ provider: "github", owner: "acme", repo: "widgets", prNumber: 42, token: "ghp_x", body: "🐛 Bulgu var" }, "2.2.2.1"));
    expect(res.status).toBe(200);
    const data = await res.json() as { ok?: boolean };
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/acme/widgets/issues/42/comments");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_x");
    expect(JSON.parse(init.body as string)).toEqual({ body: "🐛 Bulgu var" });
  });

  it("GitLab: doğru merge_requests/notes uç noktasına PRIVATE-TOKEN ile POST eder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ provider: "gitlab", owner: "grp", repo: "proj", prNumber: 7, token: "glpat_x", body: "İnceleme tamam" }, "2.2.2.2"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gitlab.com/api/v4/projects/grp%2Fproj/merge_requests/7/notes");
    const headers = init.headers as Record<string, string>;
    expect(headers["PRIVATE-TOKEN"]).toBe("glpat_x");
    expect(JSON.parse(init.body as string)).toEqual({ body: "İnceleme tamam" });
  });

  it("upstream hata verirse (403/404) 500 + okunabilir hata mesajı döner", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ provider: "github", owner: "a", repo: "b", prNumber: 1, token: "bad", body: "x" }, "3.3.3.1"));
    expect(res.status).toBe(500);
    const data = await res.json() as { error?: string };
    expect(data.error).toMatch(/404/);
  });
});
