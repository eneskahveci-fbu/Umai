/* Tarayıcıda izole JavaScript çalıştırıcı — kod yorumlayıcının JS ayağı.
   Kod, DOM erişimi olmayan bir Web Worker'da çalışır (sayfadan yalıtık); console
   çıktısı yakalanır, 5 sn zaman aşımı sonsuz döngüleri durdurur. Python tarafı
   Pyodide ile @/lib/python'da; bu modül onunla aynı {output, error?} biçimini döner. */

export function runJs(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve) => {
    if (typeof Worker === "undefined") {
      resolve({ output: "", error: "Bu tarayıcı Web Worker desteklemiyor." });
      return;
    }
    const workerSrc = `
      self.onmessage = function (e) {
        var out = [];
        function fmt(a){ return Array.prototype.map.call(a, function(x){ try { return (typeof x==='object') ? JSON.stringify(x) : String(x); } catch(_) { return String(x); } }).join(' '); }
        var sandboxConsole = { log:function(){out.push(fmt(arguments));}, info:function(){out.push(fmt(arguments));}, warn:function(){out.push(fmt(arguments));}, error:function(){out.push(fmt(arguments));}, debug:function(){out.push(fmt(arguments));} };
        (async function(){
          try {
            var fn = new Function('console', '"use strict";\\n' + e.data);
            var r = await fn(sandboxConsole);
            if (r !== undefined) out.push(typeof r === 'object' ? JSON.stringify(r) : String(r));
            self.postMessage({ output: out.join('\\n') });
          } catch (err) {
            self.postMessage({ output: out.join('\\n'), error: String((err && err.stack) || err) });
          }
        })();
      };
    `;
    const blob = new Blob([workerSrc], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch {
      URL.revokeObjectURL(url);
      resolve({ output: "", error: "Çalıştırıcı başlatılamadı." });
      return;
    }
    const cleanup = () => { try { worker.terminate(); } catch { /* yok */ } URL.revokeObjectURL(url); };
    const timer = setTimeout(() => { cleanup(); resolve({ output: "", error: "Zaman aşımı (5 sn) — sonsuz döngü olabilir." }); }, 5000);
    worker.onmessage = (ev: MessageEvent) => { clearTimeout(timer); cleanup(); resolve(ev.data as { output: string; error?: string }); };
    worker.onerror = (ev: ErrorEvent) => { clearTimeout(timer); cleanup(); resolve({ output: "", error: ev.message || "Çalıştırma hatası." }); };
    worker.postMessage(code);
  });
}
