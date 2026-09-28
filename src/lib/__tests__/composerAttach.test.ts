import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Ö11 (kullanıcı kararı, Tem 2026): sohbet composer'ındaki dosya ekleme
   menüsünde üç öğe vardı — "Dosya ekle", "Görsel ekle", "Fotoğraf çek" —
   oysa üçü de AYNI huniye (readFileIntoInput) giriyordu. Artık tek bir
   ataç düğmesi var ve doğrudan dosya seçiciyi açıyor.

   Bu test kaynak metni okur: composer JSX'i React/DOM gerektirir ve bu
   projenin testleri jsdom kullanmaz (`environment: node`). Buradaki amaç
   kararı ve accept listesinin KAPSAMINI kilitlemek. */

const src = readFileSync(join(process.cwd(), "src/components/CoderView.tsx"), "utf8");

describe("composer dosya ekleme — tek düğme (Ö11)", () => {
  /* Menü ÖĞELERİ aranıyor (label=…), çıplak metin değil: kaldırma kararını
     anlatan yorum satırları bu isimleri kaçınılmaz olarak içeriyor. */
  it("ayrı 'Görsel ekle' / 'Fotoğraf çek' menü öğeleri kaldırıldı", () => {
    expect(src).not.toMatch(/label="Görsel ekle"/);
    expect(src).not.toMatch(/label="Fotoğraf çek"/);
    expect(src).not.toContain("CameraCaptureModal");
    expect(src).not.toContain("imgRef");
    expect(src).not.toContain("cameraRef");
  });

  /* Composer'ın girişi `fileRef` ile işaretli. Dosyada başka bir `type="file"`
     bulunabilir (ör. Sunucu panelinin yükleme girişi, Ö10) — bu testin konusu
     COMPOSER, o yüzden sayım ref'e göre yapılıyor. */
  it("composer'da tek bir dosya girişi var", () => {
    expect(src.match(/ref=\{fileRef\}/g) ?? []).toHaveLength(1);
    /* Kamera girişi (capture özniteliği) tamamen kalktı. */
    expect(src).not.toContain("capture=");
  });

  it("accept listesi görselleri DE kapsar (yoksa görsel eklenemezdi)", () => {
    const m = src.match(/<input ref=\{fileRef\}[^>]*accept="([^"]+)"/);
    expect(m).toBeTruthy();
    const accept = m![1];
    expect(accept).toContain("image/*");
    /* Var olan belge desteği KORUNMALI — huninin PDF/Office/ipynb çıkarım
       yolları bu uzantılara bağlı. */
    for (const ext of [".pdf", ".docx", ".xlsx", ".pptx", ".ipynb", ".csv", ".md", ".ts"]) {
      expect(accept).toContain(ext);
    }
  });
});

/* Ö8 — Dosyalar/Sunucu panellerine Sidebar'dan GERÇEKTEN ulaşılabildiğini kilitler.
   Eyl 2026: "Araçlar" açılır menüsü kaldırıldı; Dosyalar üst seviye nav satırı,
   Sunucu ise Repolar bölümündeki "yerel" satırı oldu.
   (Sidebar JSX'i React/DOM gerektiriyor; bu proje jsdom kullanmıyor.) */
describe("Sidebar — Dosyalar/Sunucu girişleri (Ö8)", () => {
  const sidebar = readFileSync(join(process.cwd(), "src/components/Sidebar.tsx"), "utf8");

  it("iki panel de Sidebar'dan açılabiliyor", () => {
    expect(sidebar).toContain('openLeftPanel("files")');
    expect(sidebar).toContain('openLeftPanel("workspace")');
    expect(sidebar).toContain(">Dosyalar</span>");
  });

  it("mevcut saf yardımcıyı kullanan store eylemine bağlılar", () => {
    expect(sidebar).toContain("toggleLeftPanelState(which)");
  });

  it("CoderView paneli artık yerel state'te değil, store'dan okuyor", () => {
    expect(src).toContain("useStore((s) => s.leftPanel)");
    expect(src).not.toMatch(/useState<LeftPanel>/);
  });
});

/* B2 (hata taraması) — Sidebar /app, /chats, /projects, /settings sayfalarının
   hepsinde render ediliyor ama panelleri ÇİZEN CoderView yalnız /app'te:
   /app dışında tıklama sessiz bir no-op'tu ve kullanıcı sonradan /app'e
   geçtiğinde hiç açmadığını sandığı panel açık geliyordu. */
describe("Sidebar panelleri — /app dışında sessiz no-op değil (B2)", () => {
  const sidebar = readFileSync(join(process.cwd(), "src/components/Sidebar.tsx"), "utf8");

  it("girişler doğrudan store'u değil, yönlendirmeyi bilen yardımcıyı çağırır", () => {
    expect(sidebar).toContain("const openLeftPanel = useOpenLeftPanel()");
    expect(sidebar).not.toMatch(/onClick=\{\(\) => \{?\s*useStore\.getState\(\)\.toggleLeftPanelState/);
  });

  it("yardımcı /app dışındaysa önce /app'e yönlendirir", () => {
    const fn = sidebar.slice(sidebar.indexOf("function useOpenLeftPanel"), sidebar.indexOf("function repoLabel"));
    expect(fn).toContain('pathname !== "/app"');
    expect(fn).toContain('router.push("/app")');
    /* Gezinmeden gelen istek her zaman "aç" demektir — toggle DEĞİL. */
    expect(fn).toContain("setLeftPanel(which)");
    /* /app'teyken eski davranış (aç/kapat) korunur. */
    expect(fn).toContain("toggleLeftPanelState(which)");
  });
});
