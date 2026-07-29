import { afterEach, describe, expect, it, vi } from "vitest";

/* Bug (gerçek nvapi anahtarıyla canlı doğrulandı): "black-forest-labs/
   flux.1-schnell" bu hesap altında hiç yanıt vermiyor (60 sn+ asılı kalıyor)
   — kullanıcının "model çok bekletiyor" şikâyetinin bir parçası buydu.
   "flux.1-dev" aynı testte ~5 sn'de gerçek görüntü döndürdü. Ayrıca yanıt
   PNG değil JPEG (sabit "image/png" MIME'i yanlıştı) ve 422 hatasında
   `detail` bir DİZGE değil bir doğrulama DİZİSİ ([{msg,...}]) — ikisi de
   canlı yanıtlarla doğrulandı. */

import { POST } from "../route";

function req(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/image — NVIDIA NIM (flux.1-dev)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flux.1-dev ucunu çağırır, flux.1-schnell'i (asılı kalan model) ASLA çağırmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ artifacts: [{ base64: "/9j/fakejpeg" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(req({ provider: "nvidia", apiKey: "nvapi-x", prompt: "a cat" }));

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("black-forest-labs/flux.1-dev");
    expect(url).not.toContain("flux.1-schnell");
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    /* steps>=5 zorunlu (422 ile canlı doğrulandı) — 4 artık gönderilmiyor. */
    expect(sentBody.steps).toBeGreaterThanOrEqual(5);
  });

  it("JPEG baytları (canlı yanıtın gerçek biçimi) doğru MIME ile gömülür, PNG diye yutulmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ artifacts: [{ base64: "/9j/realjpegbytes" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ provider: "nvidia", apiKey: "nvapi-x", prompt: "a cat" }));
    const data = await res.json() as { image: string };
    expect(data.image).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("PNG magic byte'ıyla başlayan base64 image/png olarak işaretlenir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ artifacts: [{ base64: "iVBORw0KGgoAAA" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ provider: "nvidia", apiKey: "nvapi-x", prompt: "a cat" }));
    const data = await res.json() as { image: string };
    expect(data.image).toMatch(/^data:image\/png;base64,/);
  });

  it("422 doğrulama hatası (detail bir DİZİ) okunur bir metne çevrilir, '[object Object]' göstermez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        detail: [{ type: "greater_than_equal", loc: ["body", "steps"], msg: "Input should be greater than or equal to 5" }],
      }), { status: 422 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ provider: "nvidia", apiKey: "nvapi-x", prompt: "a cat" }));
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Input should be greater than or equal to 5");
    expect(data.error).not.toContain("[object Object]");
  });

  it("hiçbir görüntü alanı yoksa açık hata döner", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ provider: "nvidia", apiKey: "nvapi-x", prompt: "a cat" }));
    expect(res.status).toBe(502);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("NVIDIA görüntü döndürmedi");
  });
});
