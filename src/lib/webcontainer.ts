import type { WebContainer } from "@webcontainer/api";

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

export function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    typeof window.crossOriginIsolated === "boolean" &&
    window.crossOriginIsolated &&
    !isMobile()
  );
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const uaData = (navigator as any).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function getUnsupportedReason(): string | null {
  if (typeof window === "undefined") return null;
  if (isMobile()) return "WebContainer mobil tarayıcılarda çalışmaz. Masaüstünde Chrome veya Edge ile aç.";
  if (typeof SharedArrayBuffer === "undefined") return "Tarayıcı SharedArrayBuffer'ı desteklemiyor (Chrome/Edge gerekli).";
  if (!window.crossOriginIsolated) return "Sayfa cross-origin isolation'da değil (sayfayı yenilemeyi dene).";
  return null;
}

/* WebContainer is free on localhost / *.stackblitz.io / *.webcontainer.io.
   On other origins (e.g. Vercel) you need a free API key from webcontainer.dev. */
export function needsApiKey(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.endsWith(".stackblitz.io") || h.endsWith(".webcontainer.io")) return false;
  return true;
}

export async function getWebContainer(apiKey?: string): Promise<WebContainer> {
  if (instance) return instance;
  if (booting) return booting;
  if (!isSupported())
    throw new Error("Tarayıcı bu özelliği desteklemiyor (cross-origin isolation gerekli)");

  booting = (async () => {
    const mod = await import("@webcontainer/api");
    const key = apiKey?.trim();
    if (key) mod.configureAPIKey(key);
    instance = await mod.WebContainer.boot();
    booting = null;
    return instance;
  })();
  return booting;
}

export async function teardownWebContainer() {
  if (instance) {
    try { instance.teardown(); } catch { /* yok say */ }
    instance = null;
  }
}

const DEFAULT_FILES = {
  "package.json": {
    file: {
      contents: JSON.stringify({
        name: "craft-sandbox",
        type: "module",
        scripts: { start: "node index.js" },
      }, null, 2),
    },
  },
  "README.md": {
    file: {
      contents: "# Craft.Coder sandbox\n\nGerçek Node.js çalışıyor. npm/git komutları kullanılabilir.\n",
    },
  },
};

export async function mountDefaults(wc: WebContainer) {
  await wc.mount(DEFAULT_FILES);
}

export async function writeFile(wc: WebContainer, path: string, content: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 1) {
    const dir = parts.slice(0, -1).join("/");
    try { await wc.fs.mkdir(dir, { recursive: true }); } catch { /* exists */ }
  }
  await wc.fs.writeFile(path, content);
}
