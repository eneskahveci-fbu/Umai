import { afterEach, describe, expect, it, vi } from "vitest";

/* Bug (IMG_1176): Ayarlar'dan "GitHub ile bağlan" / "GitLab ile bağlan"
   (linkIdentity) denendiğinde, bağlama başarısız olunca kullanıcı /login
   ekranına atılıp "hesabımdan çıktı" izlenimine kapılıyordu. Kök neden: bu
   route, HANGİ akıştan geldiğine bakmadan her hatada koşulsuz /login'e
   yönlendiriyordu — oysa bir bağlama denemesi TANIM GEREĞİ zaten oturum açmış
   bir kullanıcıda çalışır (linkIdentity), /login ise girişli olup olmadığına
   hiç bakmaz. */

let exchangeMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: exchangeMock },
  }),
}));

import { GET } from "../route";

function req(qs: string): Request {
  return new Request(`https://umai.test/auth/callback?${qs}`);
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("/auth/callback — bağlama (linkIdentity) hatası ASLA /login'e atmaz", () => {
  afterEach(() => vi.clearAllMocks());

  it("exchangeCodeForSession başarısız olursa /app'e (next'e) hata query'siyle döner, /login'e DEĞİL", async () => {
    exchangeMock = vi.fn().mockResolvedValue({ error: { message: "Identity is already linked to another user" } });
    const res = await GET(req(`code=abc&next=${encodeURIComponent("/app?gitlink=github")}`));
    const loc = locationOf(res);
    expect(loc).not.toContain("/login");
    expect(loc).toContain("/app?gitlink=github");
    expect(loc).toContain("link_error=");
    expect(loc).toContain(encodeURIComponent("Identity is already linked to another user"));
  });

  it("sağlayıcı OAuth adımını reddederse (code yerine error_description) yine /app'e döner", async () => {
    exchangeMock = vi.fn();
    const res = await GET(req(`error_description=access_denied&next=${encodeURIComponent("/app?gitlink=gitlab")}`));
    const loc = locationOf(res);
    expect(loc).not.toContain("/login");
    expect(loc).toContain("/app?gitlink=gitlab");
    expect(loc).toContain("link_error=access_denied");
    expect(exchangeMock).not.toHaveBeenCalled();
  });

  it("next zaten '?' içeriyorsa hata parametresi '&' ile eklenir (bozuk URL üretmez)", async () => {
    exchangeMock = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const res = await GET(req(`code=abc&next=${encodeURIComponent("/app?gitlink=github&foo=bar")}`));
    const loc = locationOf(res);
    expect(loc).toContain("/app?gitlink=github&foo=bar&link_error=boom");
  });

  it("bağlama BAŞARILI olursa normal şekilde next'e (query'siz) döner", async () => {
    exchangeMock = vi.fn().mockResolvedValue({ error: null });
    const res = await GET(req(`code=abc&next=${encodeURIComponent("/app?gitlink=github")}`));
    const loc = locationOf(res);
    expect(loc).toBe("https://umai.test/app?gitlink=github");
  });
});

describe("/auth/callback — giriş/kayıt (magic-link) akışında eski davranış korunur", () => {
  afterEach(() => vi.clearAllMocks());

  it("bağlama denemesi DEĞİLSE (next=/app, gitlink yok) hata /login'e gider", async () => {
    exchangeMock = vi.fn().mockResolvedValue({ error: { message: "invalid code" } });
    const res = await GET(req("code=abc"));
    const loc = locationOf(res);
    expect(loc).toContain("/login?error=");
    expect(loc).toContain(encodeURIComponent("invalid code"));
  });

  it("başarılı magic-link/imzalı kod normal next'e döner", async () => {
    exchangeMock = vi.fn().mockResolvedValue({ error: null });
    const res = await GET(req("code=abc"));
    expect(locationOf(res)).toBe("https://umai.test/app");
  });
});
