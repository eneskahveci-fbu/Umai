/* Chat yanıtındaki kodu canvas'ta CANLI önizlemeye çevirir.
   Desteklenen: HTML, (birleşik) HTML+CSS+JS, React/JSX/TSX, düz JS, SVG, mermaid.
   Önizlenemeyen diller (python, go, sql…) için null döner → zorla bozuk önizleme yok.

   Güvenlik: çıktı ArtifactPanel'deki sandbox'lı iframe'de (allow-scripts, allow-same-origin
   YOK) çalışır → null origin, çerez/parent erişimi olmaz. */

import type { Artifact } from "./types";

interface Block { lang: string; code: string; }

const FENCE_RE = /```([a-zA-Z0-9_+#-]*)(?::[^\n]*)?\n([\s\S]*?)```/g;

export function parseBlocks(md: string): Block[] {
  const out: Block[] = [];
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(md))) out.push({ lang: (m[1] || "").toLowerCase(), code: m[2] });
  return out;
}

const isHtml = (l: string) => l === "html" || l === "htm";
const isCss = (l: string) => l === "css";
const isJs = (l: string) => l === "js" || l === "javascript" || l === "mjs";
const isReact = (l: string) => l === "jsx" || l === "tsx" || l === "react";
const isTs = (l: string) => l === "ts" || l === "typescript";

/* İçeriğin iframe'i bozmaması için </script>'i kaç. */
function safeScript(code: string): string {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

/* Gömülü console paneli — iframe'in KENDİ içinde çalışır (parent'a mesaj yok →
   sandbox basit kalır). console.log/info/warn/error + yakalanmayan hataları alt
   panelde gösterir. Öğrenciler için öğretici; çıktı olmadıkça gizli durur.
   Override scripti kullanıcı kodundan ÖNCE çalışmalı → body başına konur. */
const CONSOLE_UI =
  `<div id="__cns" style="display:none;position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;` +
  `background:#0b0b0d;color:#d6d6d6;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #333;z-index:99999"></div>` +
  `<script>(function(){var b=document.getElementById('__cns');` +
  `function esc(s){return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}` +
  `function fmt(a){return [].map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x);}catch(e){return String(x);}}).join(' ');}` +
  `function add(t,a){if(!b)return;b.style.display='block';var c=({log:'#d6d6d6',info:'#7db3ff',warn:'#e6b800',error:'#ff6b6b'})[t]||'#d6d6d6';` +
  `var d=document.createElement('div');d.style.cssText='padding:2px 10px;border-bottom:1px solid #1a1a1d;color:'+c;d.innerHTML=esc(fmt(a));b.appendChild(d);b.scrollTop=b.scrollHeight;}` +
  `['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){add(k,arguments);if(o)o.apply(console,arguments);};});` +
  `window.addEventListener('error',function(e){add('error',[e.message+' (satır '+e.lineno+')']);});` +
  `window.addEventListener('unhandledrejection',function(e){add('error',['Promise: '+((e.reason&&e.reason.message)||e.reason)]);});` +
  `})();<\/script>`;

function reactDoc(code: string, css: string): string {
  /* buildPreview zaten <html> içeren (Next.js layout benzeri, tek başına
     anlamsız render eden) bloklardan kaçınmaya çalışır; ama TEK aday oysa
     yine de buraya düşer — sessizce boş render etmek yerine net bir mesaj
     göster (kullanıcı "önizleme çalışmıyor" sanıp aramasın). */
  const isNextRootFile = /<html[\s>]/i.test(code);
  /* ESM import/export CDN-global yaklaşımıyla uyumsuz → temizle. */
  const src = code
    .replace(/^\s*import[^\n]*\n/gm, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^\s*export\s+/gm, "");
  /* Mount edilecek bileşeni bul: önce App, yoksa son tanımlı büyük-harfli bileşen. */
  let comp = /\b(?:function|const|class)\s+App\b/.test(src) ? "App" : "";
  if (!comp) {
    const names = [...src.matchAll(/(?:function|const|class)\s+([A-Z]\w*)/g)].map((x) => x[1]);
    comp = names[names.length - 1] || "";
  }
  const mount = isNextRootFile
    ? `document.getElementById('root').innerHTML='<p style="font-family:system-ui;color:#666;padding:1rem;line-height:1.5">Bu dosya kendi &lt;html&gt;/&lt;body&gt; etiketlerini tanımlıyor (ör. Next.js <code>layout.tsx</code>) — çok dosyalı bir projenin parçası olduğundan tek başına canlı önizlenemez. Gerçek bir sayfa/bileşen bloğu (ör. <code>page.tsx</code>) varsa o gösterilir; yoksa bu dosyayı bağımsız bir HTML olarak indirip tarayıcıda aç.</p>';`
    : comp
    ? `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${comp}));`
    : `document.getElementById('root').innerHTML='<p style="font-family:system-ui;color:#666;padding:1rem">Önizlenecek bir React bileşeni bulunamadı (App veya büyük-harfli bir bileşen tanımla).</p>';`;
  /* Babel'ın kendi otomatik <script type="text/babel"> tarayıcısı YERİNE
     Babel.transform()'u BİZ, kendi (aynı-belge) script'imizden çağırıyoruz.
     Neden: sandbox'lı iframe'in ("allow-same-origin" YOK) opak origin'i
     yüzünden, otomatik tarayıcının İÇİNDE (babel.min.js — cross-origin
     script) fırlayan bir sözdizimi hatası window.onerror'a opak, tanısız
     bir "Script error." olarak düşüyordu — try/catch'imiz hiç devreye
     girmiyordu (yalnız ÇALIŞTIRMA adımını sarıyordu, DÖNÜŞTÜRME adımını
     değil). Transform'u kendi try/catch'imizin İÇİNDE çağırınca (normal bir
     fonksiyon çağrısı — Babel global'i cross-origin'den gelse de burada
     throw ettiği hata window.onerror'a değil doğrudan bizim catch'imize
     düşer) hem sözdizimi hem çalışma-zamanı hataları aynı okunaklı kırmızı
     kutuda görünür. */
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}${css}</style>
</head><body>${CONSOLE_UI}<div id="root"></div>
<script type="text/plain" id="__src">${safeScript(src)}</script>
<script>
(function(){
  function showError(e){
    document.getElementById('root').innerHTML='<pre style="color:#c00;white-space:pre-wrap;padding:1rem;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace">'+((e&&(e.stack||e.message))||e)+'</pre>';
  }
  /* mount build-time'da bilinen sabit kod — JSON.stringify her tırnak/
     ters eğik çizgiyi doğru kaçırır, elle escape hataya açık. */
  var MOUNT_CODE = ${JSON.stringify(mount)};
  try {
    var raw = document.getElementById('__src').textContent;
    var transformed = Babel.transform(raw, {presets:['typescript','react'], filename:'component.tsx'}).code;
    var runner = new Function('React','ReactDOM','useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','Fragment',
      transformed + '\\n' + MOUNT_CODE);
    runner(React,ReactDOM,React.useState,React.useEffect,React.useRef,React.useMemo,React.useCallback,React.useReducer,React.useContext,React.Fragment);
  } catch(e) { showError(e); }
})();
</script></body></html>`;
}

function jsDoc(js: string, css: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem}${css}</style></head><body>${CONSOLE_UI}
<script>try{${safeScript(js)}}catch(e){document.body.innerHTML='<pre style="color:#c00;white-space:pre-wrap">'+(e&&e.stack||e)+'</pre>';}</script></body></html>`;
}

function htmlDoc(html: string, css: string, js: string): string {
  const isFull = /<html[\s>]/i.test(html);
  if (isFull) {
    let doc = html;
    /* replacement FONKSİYON olmalı: kullanıcı CSS/JS'i string olarak verilirse
       içindeki $&, $' gibi kalıplar replace tarafından yorumlanıp çıktıyı bozar. */
    if (css) doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, () => `<style>${css}</style></head>`) : `<style>${css}</style>` + doc;
    if (js) doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, () => `<script>${safeScript(js)}</script></body>`) : doc + `<script>${safeScript(js)}</script>`;
    return doc;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:1rem}${css}</style></head><body>${CONSOLE_UI}
${html}
${js ? `<script>${safeScript(js)}</script>` : ""}</body></html>`;
}

/** Markdown yanıtından canlı önizlenebilir bir Artifact üretir; yoksa null. */
export function buildPreview(markdown: string): Artifact | null {
  const blocks = parseBlocks(markdown);
  if (!blocks.length) return null;

  const css = blocks.filter((b) => isCss(b.lang)).map((b) => b.code).join("\n");
  const js = blocks.filter((b) => isJs(b.lang)).map((b) => b.code).join("\n");
  const html = blocks.find((b) => isHtml(b.lang));
  /* Yanıtta birden fazla .tsx/.jsx bloğu olabilir (ör. çok dosyalı bir Next.js
     projesi: layout.tsx + gerçek bir sayfa/bileşen). layout.tsx gibi Next.js
     kök dosyaları kendi <html>/<body> etiketlerini tanımlar — tek başına
     mount edilince (children prop'u boş) tamamen BOŞ render eder, hata da
     vermez. Böyle bloklar elenir; kalan adaylardan SONUNCUSU (genelde asıl
     önizlenecek bileşen) seçilir. Tek aday varsa davranış değişmez. */
  const reactCandidates = blocks.filter((b) => isReact(b.lang) || (isTs(b.lang) && /<[A-Za-z]/.test(b.code)));
  const previewable = reactCandidates.filter((b) => !/<html[\s>]/i.test(b.code));
  const react = previewable[previewable.length - 1] ?? reactCandidates[reactCandidates.length - 1];
  const svg = blocks.find((b) => b.lang === "svg" || (!b.lang && b.code.trimStart().startsWith("<svg")));
  const mermaid = blocks.find((b) => b.lang === "mermaid");

  if (react) return { type: "html", content: reactDoc(react.code, css), title: "React Önizleme" };
  if (html) return { type: "html", content: htmlDoc(html.code, css, js), title: "HTML Önizleme" };
  if (mermaid) return { type: "mermaid", content: mermaid.code, title: "Mermaid Önizleme" };
  if (svg) return { type: "svg", content: svg.code, title: "SVG Önizleme" };
  if (js) return { type: "html", content: jsDoc(js, css), title: "JS Önizleme" };
  if (css) return { type: "html", content: htmlDoc("<div>CSS önizleme</div>", css, ""), title: "CSS Önizleme" };
  return null;
}

/** Tek bir kod bloğu (CodeBlock'taki "Önizle" düğmesi) için önizleme üretir. */
export function buildSingleBlockPreview(lang: string, code: string): Artifact | null {
  return buildPreview("```" + (lang || "") + "\n" + code + "\n```");
}
