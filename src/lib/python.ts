/* Tarayıcı içi Python — Pyodide (CPython, WASM). Kod sunucuya gitmeden
   tamamen kullanıcının tarayıcısında çalışır. Pyodide (~10MB) ilk çalıştırmada
   jsDelivr CDN'inden TEMBEL yüklenir; yüklenemezse hata mesajı döner.

   Not: /app sayfası COEP require-corp altında olduğundan script crossorigin
   ile yüklenir (CDN CORS başlıkları gönderir). */

const PYODIDE_VERSION = "0.28.3";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackagesFromImports: (code: string) => Promise<void>;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

let pyodidePromise: Promise<PyodideInstance | null> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Pyodide betiği yüklenemedi"));
    document.head.appendChild(s);
  });
}

async function getPyodide(): Promise<PyodideInstance | null> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      try {
        await injectScript(`${CDN}pyodide.js`);
        if (!window.loadPyodide) return null;
        return await window.loadPyodide({ indexURL: CDN });
      } catch {
        return null;
      }
    })();
  }
  return pyodidePromise;
}

export interface PyRunResult {
  output: string;
  error?: string;
}

/** Python kodunu çalıştırır; stdout/stderr ve (varsa) son ifadenin değerini
    toplar. `onLoading` model indirilirken bir kez çağrılır. */
export async function runPython(
  code: string,
  onLoading?: () => void,
): Promise<PyRunResult> {
  const ready = pyodidePromise !== null;
  if (!ready) onLoading?.();
  const py = await getPyodide();
  if (!py) {
    return { output: "", error: "Pyodide yüklenemedi (ağ erişimi gerekli)." };
  }
  let buffer = "";
  py.setStdout({ batched: (s) => { buffer += s + "\n"; } });
  py.setStderr({ batched: (s) => { buffer += s + "\n"; } });
  try {
    /* import edilen paketleri (numpy vb.) otomatik yükle. */
    await py.loadPackagesFromImports(code).catch(() => {});
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      buffer += String(result) + "\n";
    }
    return { output: buffer.trimEnd() };
  } catch (e) {
    return { output: buffer.trimEnd(), error: (e as Error).message };
  }
}
