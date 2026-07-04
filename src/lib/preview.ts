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
  const mount = comp
    ? `try{ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${comp}));}catch(e){document.getElementById('root').innerHTML='<pre style="color:#c00;white-space:pre-wrap;padding:1rem">'+(e&&e.stack||e)+'</pre>';}`
    : `document.getElementById('root').innerHTML='<p style="font-family:system-ui;color:#666;padding:1rem">Önizlenecek bir React bileşeni bulunamadı (App veya büyük-harfli bir bileşen tanımla).</p>';`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}${css}</style>
</head><body>${CONSOLE_UI}<div id="root"></div>
<script type="text/babel" data-presets="typescript,react">
const {useState,useEffect,useRef,useMemo,useCallback,useReducer,useContext,Fragment}=React;
${safeScript(src)}
${mount}
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
  const react = blocks.find((b) => isReact(b.lang) || (isTs(b.lang) && /<[A-Za-z]/.test(b.code)));
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
