import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* H7 — "sohbet ederken tarayıcı donup kendini yeniden başlatıyor ve sanki
   eski commit'e geri dönüyor".

   İki ayrı davranış bu belirtiyi üretiyordu ve ikisi de burada kilitleniyor:

   (a) public/sw.js'teki sürüm damgası SABİT bir literaldi ("craft-v3"). Önbellek
       adları hiç değişmediği için `activate`'teki temizlik hiçbir şey silmiyor,
       /_next/static/* cache-first olduğundan geçmiş TÜM derlemelerin chunk'ları
       önbellekte kalıyordu. Tek bir başarısız gezinme isteği network-first'ün
       catch dalını tetikleyip dağıtım ÖNCESİ HTML'i sunuyor, o HTML eski chunk
       hash'lerini istiyor, chunk'lar da önbellekte olduğu için önceki derleme
       bütünüyle açılıyordu.

   (b) Yeni SW devralınca sayfa OTOMATİK yenileniyordu.

   Bu testler kaynak metni okur: service worker ve registrar tarayıcı API'lerine
   (self.location, navigator.serviceWorker) bağlı olduğu için `environment: node`
   altında çalıştırılamaz, ama bu iki KARARIN geri alınması yakalanabilir. */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("service worker sürümleme (H7)", () => {
  it("sw.js sürümü sabit literal DEĞİL — kendi URL'inden okunur", () => {
    const sw = read("public/sw.js");
    expect(sw).toMatch(/const VERSION =[\s\S]{0,400}?searchParams\.get\("v"\)/);
    /* Sabit atama geri gelmemeli. */
    expect(sw).not.toMatch(/^const VERSION = "[^"]+";$/m);
  });

  it("registrar sw.js'i sürüm damgasıyla kaydeder", () => {
    const reg = read("src/lib/sw-register.ts");
    expect(reg).toContain("NEXT_PUBLIC_BUILD_ID");
    expect(reg).toMatch(/register\(`\/sw\.js\?v=\$\{/);
  });

  it("next.config.ts derlemeye özel BUILD_ID üretir", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain("NEXT_PUBLIC_BUILD_ID");
    expect(cfg).toContain("VERCEL_GIT_COMMIT_SHA");
  });
});

describe("otomatik yenileme kaldırıldı (H7)", () => {
  const reg = read("src/lib/sw-register.ts");

  it("controllerchange sayfayı KENDİLİĞİNDEN yenilemez — kullanıcıya sorar", () => {
    /* Tek `location.reload()` çağrısı kullanıcının tıkladığı eylemin içinde
       olmalı; controllerchange yolunda doğrudan reload OLMAMALI. */
    expect(reg).toContain("promptForUpdate");
    expect(reg).not.toContain("scheduleReloadAfterStreaming");
    const controllerBlock = reg.slice(reg.indexOf("controllerchange"), reg.indexOf("const register"));
    expect(controllerBlock).not.toContain("reload()");
  });

  it("kullanıcı Yenile derse ÖNCE persistCurrent, SONRA reload", () => {
    /* Sıra bozulursa yeniden yüklemede loadChats buluttaki ESKİ kopyayı çeker
       ve biten yanıt kaybolur. */
    const m = reg.match(/persistCurrent\(\)[\s\S]{0,300}?location\.reload\(\)/);
    expect(m).toBeTruthy();
  });
});
