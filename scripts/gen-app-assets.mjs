/* Native uygulama ikon/splash PNG'lerini üretir (Capacitor `resources/`).
   Marka görseli src/app/_logo.tsx (LogoTile) ile aynı dil: koyu gradyan kart,
   amber altıgen + merkez kıvılcım. Tarayıcıda (Playwright) render edilip
   ekran görüntüsü alınır — ekstra görüntü kütüphanesi gerekmez.

   Kullanım: npm run assets:gen   (PW_EXECUTABLE_PATH ile özel Chromium yolu) */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "resources");
mkdirSync(out, { recursive: true });

/* LogoTile ile aynı geometri/renkler (SVG). */
const logoSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 16 L79 33 V67 L50 84 L21 67 V33 Z" fill="none" stroke="#cda57c" stroke-width="5" stroke-linejoin="round"/>
  <path d="M50 38 L54.5 45.5 L62 50 L54.5 54.5 L50 62 L45.5 54.5 L38 50 L45.5 45.5 Z" fill="#ecd2a8"/>
</svg>`;

const iconHtml = `<!doctype html><html><body style="margin:0">
<div style="width:1024px;height:1024px;display:grid;place-items:center;background:linear-gradient(160deg,#24201a 0%,#100f0d 100%)">
  ${logoSvg(620)}
</div></body></html>`;

const splashHtml = `<!doctype html><html><body style="margin:0">
<div style="width:2732px;height:2732px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px;background:#111110">
  ${logoSvg(560)}
  <div style="font:700 96px system-ui,sans-serif;color:#e8e4dc;letter-spacing:-2px">Craft<span style="color:#c8a87e">.Coder</span></div>
</div></body></html>`;

async function shoot(browser, html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(join(out, file), buf);
  await page.close();
  console.log(`✓ resources/${file} (${w}x${h}, ${(buf.length / 1024).toFixed(0)} KB)`);
}

const browser = await chromium.launch({
  ...(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}),
  args: ["--no-sandbox"],
});
await shoot(browser, iconHtml, 1024, 1024, "icon.png");
await shoot(browser, splashHtml, 2732, 2732, "splash.png");
await shoot(browser, splashHtml, 2732, 2732, "splash-dark.png");
await browser.close();
console.log("Bitti. Platform ekledikten sonra: npm run cap:assets");
