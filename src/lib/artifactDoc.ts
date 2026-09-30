import type { Artifact } from "./types";

/* Metni HTML içine gömerken güvenli hâle getirir (& < > escape) — hem
   sözdizimi vurgulama (hljs, escaped text bekler) hem de düz metni bir
   <script>/<div> taşıyıcısına RAWTEXT-güvenli koymak için (</script> gibi
   kapatıcı diziler artık literal metin olarak kalmaz). textContent okurken
   taraycı otomatik geri çözer. */
function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* JSON.stringify TEK BAŞINA `</script>` dizisini KAÇIRMAZ — kullanıcı
   içeriği (ör. bir SQL yorumunda ya da Python string'inde geçen
   "</script>") doğrudan bir <script> bloğuna JSON.stringify ile gömülürse
   iframe'in script etiketini ERKEN KAPATIP ardından gelen HTML'i (kullanıcı
   girdisinden) yürütür — sql/python artifact'larında GERÇEK bir XSS yolu.
   safeScript (preview.ts) bunu ham kaynak için yapıyor; burada JSON string
   LİTERALİ için aynı korumayı uygular. */
function jsStringLiteral(s: string): string {
  return JSON.stringify(s).replace(/<\/script/gi, "<\\/script");
}

/* Bir artifact'ı (html/svg/mermaid/code/markdown) sandbox iframe'de göstermek
   için tam HTML belgesi üretir. ArtifactPanel (canlı önizleme) ve /a/[id]
   (yayınlanan sayfa) AYNI mantığı kullanır → tutarlı render + tek kaynak. */
export function buildArtifactSrcDoc(type: Artifact["type"], content: string, language?: string): string {
  if (type === "mermaid") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script><style>body{margin:1.5rem;background:#fff;font-family:system-ui,sans-serif;}</style></head><body><div class="mermaid">${content}</div><script>mermaid.initialize({startOnLoad:true,theme:'default'});<\/script></body></html>`;
  }
  if (type === "svg") {
    return `<!DOCTYPE html><html><head><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111110;}</style></head><body>${content}</body></html>`;
  }
  if (type === "code") {
    const lang = (language || "plaintext").toLowerCase();
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/common.min.js"><\/script>
<style>body{margin:0;background:#0d1117;} pre{margin:0;padding:1.5rem;overflow:auto;min-height:100vh;box-sizing:border-box;} code{font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace!important;}</style>
</head><body><pre><code class="language-${lang}">${htmlEscape(content)}</code></pre>
<script>try{hljs.highlightAll();}catch(e){}<\/script></body></html>`;
  }
  if (type === "sql") {
    /* sql.js (in-memory SQLite, CDN/WASM) — GERÇEKTEN çalıştırır, yalnız
       vurgulamaz. db.exec() tüm script'i (birden çok ';'-ayrılmış deyim
       dahil) TEK çağrıda kendi SQL ayrıştırıcısıyla işler — bir string
       literal içindeki ';' saf split() ile bölünseydi kırılırdı, exec()'te
       kırılmaz. */
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js"><\/script>
<style>body{font-family:system-ui,sans-serif;margin:1rem;background:#fff}
table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:12px;}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}
th{background:#f5f5f5;font-weight:600;}
tr:nth-child(even){background:#fafafa;}
.error{color:#e53e3e;font-weight:600;margin-top:8px;white-space:pre-wrap;}
pre{background:#f7f7f7;padding:12px;border-radius:6px;overflow:auto;font-size:12px;}
</style></head>
<body><div id="out">Çalıştırılıyor…</div>
<script>
initSqlJs({locateFile:function(f){return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/'+f;}}).then(function(SQL){
  var out=document.getElementById('out');
  out.textContent='';
  var db=new SQL.Database();
  var sql=${jsStringLiteral(content)};
  try{
    var results=db.exec(sql);
    if(results.length){
      results.forEach(function(r){
        var t=document.createElement('table');
        var hr=t.insertRow();
        r.columns.forEach(function(c){var th=document.createElement('th');th.textContent=c;hr.appendChild(th);});
        r.values.forEach(function(row){var tr=t.insertRow();row.forEach(function(v){var td=tr.insertCell();td.textContent=v==null?'NULL':String(v);});});
        out.appendChild(t);
      });
    } else {
      var p=document.createElement('pre');p.textContent='Çalıştırıldı (sonuç kümesi yok).';out.appendChild(p);
    }
  }catch(e){
    var d=document.createElement('div');d.className='error';d.textContent='Hata: '+e.message;out.appendChild(d);
  }
}).catch(function(e){document.getElementById('out').textContent='sql.js yüklenemedi: '+e;});
<\/script></body></html>`;
  }
  if (type === "python") {
    /* Pyodide (WASM Python, CDN) — GERÇEKTEN çalıştırır. stdout/stderr,
       __user_code'u Pyodide global'ine YAZIP (py.globals.set) Python
       tarafında contextlib.redirect_stdout/stderr ile yakalanır — kullanıcı
       kodu JS string'i içine gömülmez, üç seviyeli tırnak/escape karmaşası
       (TS şablonu → JS şablonu → Python string'i) baştan önlenir. */
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js"><\/script>
<style>body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:1rem;background:#0b0b0d;color:#d6d6d6;font-size:13px;}
#out{white-space:pre-wrap;}
.err{color:#fc8181;white-space:pre-wrap;margin-top:8px;}
.loading{color:#888;font-style:italic;}
</style></head>
<body><div id="out" class="loading">Python ortamı yükleniyor (Pyodide)…</div>
<script>
(async function(){
  var out=document.getElementById('out');
  try{
    var py=await loadPyodide();
    out.classList.remove('loading');
    out.textContent='';
    py.globals.set('__user_code', ${jsStringLiteral(content)});
    var PY_RUNNER =
      "import sys, io, contextlib, traceback\\n" +
      "_stdout = io.StringIO()\\n" +
      "_stderr = io.StringIO()\\n" +
      "_err = None\\n" +
      "with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):\\n" +
      "    try:\\n" +
      "        exec(__user_code, {'__name__': '__main__'})\\n" +
      "    except Exception:\\n" +
      "        _err = traceback.format_exc()\\n" +
      "(_stdout.getvalue(), _stderr.getvalue(), _err)\\n";
    var result=py.runPython(PY_RUNNER);
    var parts=result.toJs();
    result.destroy();
    var stdout=parts[0], stderr=parts[1], err=parts[2];
    var shown=(stdout||'')+(stderr?(stdout?'\\n':'')+stderr:'');
    if(shown) out.textContent=shown;
    if(err){var d=document.createElement('div');d.className='err';d.textContent=err;out.appendChild(d);}
    if(!shown&&!err) out.textContent='(çıktı yok)';
  }catch(e){
    out.classList.remove('loading');
    var d=document.createElement('div');d.className='err';d.textContent='Hata: '+e;out.appendChild(d);
  }
})();
<\/script></body></html>`;
  }
  if (type === "markdown") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>
<style>
body{margin:0;background:#fff;display:flex;justify-content:center;}
.doc{max-width:720px;width:100%;padding:3rem 2rem;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.75;font-size:17px;}
.doc h1,.doc h2,.doc h3{font-family:system-ui,-apple-system,sans-serif;font-weight:700;line-height:1.3;}
.doc h1{font-size:2rem;margin:0 0 1rem}
.doc h2{font-size:1.4rem;margin:2rem 0 .75rem}
.doc h3{font-size:1.15rem;margin:1.5rem 0 .5rem}
.doc p{margin:0 0 1.1rem}
.doc code{font-family:ui-monospace,monospace;background:#f2f1ed;padding:.15em .4em;border-radius:4px;font-size:.9em;}
.doc pre{background:#f2f1ed;padding:1rem;border-radius:8px;overflow:auto;}
.doc pre code{background:none;padding:0;}
.doc blockquote{border-left:3px solid #d97757;margin:0 0 1.1rem;padding:.1rem 0 .1rem 1.1rem;color:#555;}
.doc table{border-collapse:collapse;width:100%;margin:0 0 1.1rem;}
.doc th,.doc td{border:1px solid #e0ddd6;padding:.5rem .75rem;text-align:left;}
.doc ul,.doc ol{margin:0 0 1.1rem;padding-left:1.4rem;}
</style>
</head><body><div id="md-src" style="display:none">${htmlEscape(content)}</div><div class="doc" id="doc"></div>
<script>
var raw=document.getElementById('md-src').textContent;
document.getElementById('doc').innerHTML=marked.parse(raw);
<\/script></body></html>`;
  }
  /* html */
  /* preview.ts'in AYNI kontrolü (ör. htmlDoc'taki isFull) harf duyarsız
     `/<html[\s>]/i` kullanıyor; burası önceden yalnız küçük-harf
     `content.includes("<html")` arıyordu — bir artifact "<HTML>" (büyük
     harf) ile başlarsa canlı sohbet önizlemesi onu ZATEN tam belge sayıp
     olduğu gibi gösterirken, burası (yayınlanan /a/[id] ve panel) onu
     eksik sanıp içine BİR DAHA <html><body> sarardı — iç içe/bozuk belge. */
  return /<html[\s>]/i.test(content)
    ? content
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem;}</style></head><body>${content}</body></html>`;
}

/* Annotation Mode ("İşaretle & Değiştir", Google AI Studio'nun Annotation
   Mode'undan ilham) — YALNIZ canlı önizleme iframe'ine eklenir; yayınlanan
   /a/[id] sayfası buildArtifactSrcDoc'u script'siz kullanmaya devam eder.
   Sandbox allow-same-origin İÇERMEZ (opak origin) → çocuk, parent'a yalnız
   targetOrigin '*' ile postMessage edebilir; güven doğrulaması PARENT'ta
   yapılır (e.source === iframe.contentWindow + veri şekli kontrolü). */
export function withAnnotationScript(srcdoc: string): string {
  const script = `<script>(function(){
var HL=';outline:2px dashed #d97757;outline-offset:2px;cursor:crosshair';
var prev=null,prevStyle=null;
function clear(){if(prev){if(prevStyle===null)prev.removeAttribute('style');else prev.setAttribute('style',prevStyle);prev=null;prevStyle=null;}}
function skip(el){return !el||el===document.body||el===document.documentElement;}
document.addEventListener('mouseover',function(e){var el=e.target;if(el===prev||skip(el))return;clear();prev=el;prevStyle=el.getAttribute('style');el.setAttribute('style',(prevStyle||'')+HL);},true);
document.addEventListener('mouseout',function(){clear();},true);
document.addEventListener('click',function(e){
  e.preventDefault();e.stopPropagation();
  var el=e.target;if(skip(el))return;
  clear();
  var d='<'+el.tagName.toLowerCase();
  if(el.id)d+=' id="'+el.id+'"';
  var cls=(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).slice(0,2).join(' ');
  if(cls)d+=' class="'+cls+'"';
  d+='>';
  var t=(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60);
  if(t)d+=' “'+t+'”';
  try{parent.postMessage({__umaiAnnotate:true,descriptor:d},'*');}catch(err){/* yok say */}
},true);
})();<\/script>`;
  const i = srcdoc.lastIndexOf("</body>");
  return i === -1 ? srcdoc + script : srcdoc.slice(0, i) + script + srcdoc.slice(i);
}

const CODE_EXT: Record<string, string> = {
  python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts",
  go: "go", golang: "go", rust: "rs", rs: "rs", java: "java", c: "c", cpp: "cpp",
  "c++": "cpp", csharp: "cs", "c#": "cs", ruby: "rb", rb: "rb", php: "php",
  swift: "swift", kotlin: "kt", bash: "sh", sh: "sh", shell: "sh", sql: "sql",
  yaml: "yml", yml: "yml", json: "json", jsx: "jsx", tsx: "tsx",
};

/* HTML ÖZNİTELİĞİ (attribute) içine gömerken güvenli hâle getirir — htmlEscape
   yalnız & < > kaçırır, ama çift tırnaklı bir öznitelik değerinde (`srcdoc="…"`)
   kaçmamış bir `"` içeriği dışına taşırıp keyfi HTML/script enjeksiyonuna
   (kabuk belgesinde) yol açar. */
function attrEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/* "Yeni sekmede aç": blob: URL'ler OLUŞTURAN sayfanın origin'ini miras alır
   (canlı önizlemedeki sandbox'lı <iframe srcDoc> ile AYNI korumaya sahip
   DEĞİLDİR) — untrusted artifact içeriği doğrudan blob'a konursa, içindeki
   herhangi bir script yeni sekmede gerçek uygulama origin'iyle (çerezler,
   localStorage/IndexedDB, service worker) çalışır; sandbox tamamen atlanmış
   olur. Düzeltme: blob'un DIŞ kabuğu hiçbir kullanıcı script'i çalıştırmaz —
   yalnız asıl içeriği, canlı önizlemenin kullandığı AYNI
   sandbox="allow-scripts allow-modals" (allow-same-origin YOK → opak origin)
   iframe'e srcdoc olarak gömer. */
export function buildStandaloneSandboxDoc(srcdoc: string, autoPrint = false): string {
  /* autoPrint: yazdırma tetikleyicisi DIŞ (güvenilir, bizim yazdığımız) kabukta
     çalışır — window.print() üst pencereyi (sandbox'lı iframe'i içeren sayfayı)
     yazdırır; içerideki opak-origin iframe'e hiç erişmez/güvenmez. */
  const printScript = autoPrint
    ? `<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#111110;}iframe{border:0;width:100%;height:100%;display:block;}</style></head><body><iframe sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer" srcdoc="${attrEscape(srcdoc)}"></iframe>${printScript}</body></html>`;
}

/* İndirme için uzantı + gövde (html'de tam belge, diğerlerinde ham içerik). */
export function artifactDownload(type: Artifact["type"], content: string, language?: string): { ext: string; body: string } {
  const ext =
    type === "svg" ? "svg" :
    type === "mermaid" ? "mmd" :
    type === "markdown" ? "md" :
    type === "sql" ? "sql" :
    type === "python" ? "py" :
    type === "code" ? (CODE_EXT[(language || "").toLowerCase()] ?? "txt") :
    "html";
  const body = type === "html" ? buildArtifactSrcDoc(type, content) : content;
  return { ext, body };
}
