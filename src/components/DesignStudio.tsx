"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download, FileCode, FileImage, FileText, Image as ImageIcon, LayoutGrid, LayoutTemplate, Loader2,
  MessageSquare, Plus, Save, Send, Sliders, Sparkles, Trash2, Type, Upload, Wand2, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { decryptField, isEncrypted } from "@/lib/secureKeys";
import { buildFallbackChain } from "@/lib/fallback";
import type { SavedDesign } from "@/lib/types";

/* Tasarım Stüdyosu — Claude Design benzeri AI tasarım alanı (craft teması).
   Sol: doğal dille sohbet (ÜCRETSİZ LLM ile tasarım üret/değiştir + görsel bağlam).
   Orta: canlı tuval (öğe seç → doğrudan düzenle). Sağ: Tweaks (boyut/arka plan/
   katman) + AI slider'lar (boşluk/ölçek/renk tonu). Dışa aktarma: PNG · HTML · PDF.
   Tüm AI çağrıları anahtarsız Pollinations tabanına düşer → maliyetsiz. */

type Align = "left" | "center" | "right";
interface Layer { id: string; text: string; x: number; y: number; size: number; color: string; weight: number; align: Align; font: string; }
interface Design { fmt: string; w: number; h: number; bgType: "gradient" | "color" | "image"; c1: string; c2: string; bgImage: string; layers: Layer[]; }

const FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: "slide", label: "Slayt 16:9", w: 1280, h: 720 },
  { id: "poster", label: "Afiş / Poster", w: 1080, h: 1350 },
  { id: "a4", label: "Broşür (A4)", w: 1240, h: 1754 },
  { id: "square", label: "Sosyal Kare 1:1", w: 1080, h: 1080 },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920 },
];

const FONTS = ["Georgia, serif", "Arial, sans-serif", "Impact, sans-serif", "'Times New Roman', serif", "'Courier New', monospace", "system-ui, sans-serif"];

/* Çıktı kalitesi: PNG dışa aktarımda raster ölçeği (daha yüksek = daha keskin). */
const QUALITY: Record<string, { label: string; mult: number }> = {
  low: { label: "Düşük", mult: 1 },
  medium: { label: "Orta", mult: 1.5 },
  high: { label: "Yüksek", mult: 2 },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.5));

function template(fmt: typeof FORMATS[number], kind: "sunum" | "prototip" | "sablon" | "bos" = "sunum"): Design {
  const base: Design = { fmt: fmt.id, w: fmt.w, h: fmt.h, bgType: "gradient", c1: "#c8a87e", c2: "#1b1a17", bgImage: "", layers: [] };
  if (kind === "bos") return base;
  if (kind === "prototip") {
    return {
      ...base, c1: "#1e293b", c2: "#0f172a",
      layers: [
        { id: uid(), text: "Uygulama Başlığı", x: 0.5, y: 0.18, size: Math.round(fmt.w * 0.05), color: "#e2e8f0", weight: 800, align: "center", font: FONTS[5] },
        { id: uid(), text: "▢  Bileşen / kart alanı", x: 0.5, y: 0.5, size: Math.round(fmt.w * 0.03), color: "#94a3b8", weight: 500, align: "center", font: FONTS[5] },
        { id: uid(), text: "Birincil Eylem", x: 0.5, y: 0.82, size: Math.round(fmt.w * 0.028), color: "#0f172a", weight: 700, align: "center", font: FONTS[5] },
      ],
    };
  }
  return {
    ...base,
    layers: [
      { id: uid(), text: "BAŞLIK", x: 0.5, y: 0.42, size: Math.round(fmt.w * 0.075), color: "#ffffff", weight: 800, align: "center", font: FONTS[2] },
      { id: uid(), text: "Alt başlık buraya", x: 0.5, y: 0.56, size: Math.round(fmt.w * 0.032), color: "#f0ebe0", weight: 400, align: "center", font: FONTS[0] },
    ],
  };
}

const PRESETS: { name: string; c1: string; c2: string; tc: string }[] = [
  { name: "Amber", c1: "#c8a87e", c2: "#1b1a17", tc: "#ffffff" },
  { name: "Gece", c1: "#1e293b", c2: "#0f172a", tc: "#e2e8f0" },
  { name: "Gün batımı", c1: "#f97316", c2: "#7c2d12", tc: "#fff7ed" },
  { name: "Okyanus", c1: "#0ea5e9", c2: "#0c4a6e", tc: "#f0f9ff" },
  { name: "Orman", c1: "#16a34a", c2: "#14532d", tc: "#f0fdf4" },
  { name: "Krem", c1: "#f5efe2", c2: "#d8cdb4", tc: "#3a2f1d" },
];

/* Hazır şablonlar (Canva / OnlyOffice ilhamı) — slayt, afiş, sosyal, alıntı.
   sizePct: yazıboyu/genişlik oranı (formata göre ölçeklenir). font: FONTS indeksi. */
interface TplLayer { text: string; x: number; y: number; sizePct: number; color: string; weight: number; align: Align; font: number; }
interface Template { name: string; cat: string; fmt: string; bgType: "gradient" | "color"; c1: string; c2: string; layers: TplLayer[]; }

const TEMPLATES: Template[] = [
  { name: "Sunum Kapağı", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#1e293b", c2: "#0f172a", layers: [
    { text: "SUNUM BAŞLIĞI", x: 0.5, y: 0.42, sizePct: 0.07, color: "#ffffff", weight: 800, align: "center", font: 5 },
    { text: "Alt başlık · konuşmacı adı", x: 0.5, y: 0.56, sizePct: 0.028, color: "#94a3b8", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Webinar", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#0c4a6e", c2: "#0ea5e9", layers: [
    { text: "Ücretsiz Webinar", x: 0.08, y: 0.34, sizePct: 0.06, color: "#f0f9ff", weight: 800, align: "left", font: 5 },
    { text: "Modern Web Geliştirme", x: 0.08, y: 0.47, sizePct: 0.035, color: "#bae6fd", weight: 500, align: "left", font: 5 },
    { text: "Kayıt: site.com/webinar", x: 0.08, y: 0.8, sizePct: 0.026, color: "#e0f2fe", weight: 400, align: "left", font: 4 },
  ] },
  { name: "Minimal Alıntı", cat: "Sosyal", fmt: "square", bgType: "gradient", c1: "#f5efe2", c2: "#d8cdb4", layers: [
    { text: "Sadelik, nihai inceliktir.", x: 0.5, y: 0.46, sizePct: 0.058, color: "#3a2f1d", weight: 700, align: "center", font: 0 },
    { text: "— Leonardo da Vinci", x: 0.5, y: 0.62, sizePct: 0.03, color: "#6b5d44", weight: 500, align: "center", font: 0 },
  ] },
  { name: "İndirim", cat: "Sosyal", fmt: "square", bgType: "gradient", c1: "#dc2626", c2: "#7f1d1d", layers: [
    { text: "%50", x: 0.5, y: 0.4, sizePct: 0.2, color: "#ffffff", weight: 800, align: "center", font: 2 },
    { text: "İNDİRİM", x: 0.5, y: 0.6, sizePct: 0.08, color: "#fee2e2", weight: 700, align: "center", font: 2 },
    { text: "Sezon sonu fırsatları", x: 0.5, y: 0.74, sizePct: 0.032, color: "#fecaca", weight: 400, align: "center", font: 1 },
  ] },
  { name: "Ürün Tanıtımı", cat: "Sosyal", fmt: "square", bgType: "gradient", c1: "#16a34a", c2: "#14532d", layers: [
    { text: "Yeni Ürün", x: 0.5, y: 0.4, sizePct: 0.07, color: "#f0fdf4", weight: 800, align: "center", font: 5 },
    { text: "Şimdi satışta", x: 0.5, y: 0.54, sizePct: 0.035, color: "#bbf7d0", weight: 500, align: "center", font: 5 },
  ] },
  { name: "Etkinlik Afişi", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#7c2d12", c2: "#f97316", layers: [
    { text: "MÜZİK GECESİ", x: 0.5, y: 0.34, sizePct: 0.085, color: "#fff7ed", weight: 800, align: "center", font: 2 },
    { text: "21 Haziran · 20:00", x: 0.5, y: 0.66, sizePct: 0.04, color: "#fff7ed", weight: 600, align: "center", font: 1 },
    { text: "Açık Hava Sahnesi", x: 0.5, y: 0.74, sizePct: 0.03, color: "#ffedd5", weight: 400, align: "center", font: 1 },
  ] },
  { name: "Portfolyo", cat: "Afiş", fmt: "poster", bgType: "color", c1: "#111110", c2: "#111110", layers: [
    { text: "PORTFOLYO", x: 0.5, y: 0.44, sizePct: 0.085, color: "#c8a87e", weight: 800, align: "center", font: 2 },
    { text: "2025", x: 0.5, y: 0.56, sizePct: 0.04, color: "#a8a29e", weight: 400, align: "center", font: 0 },
  ] },
  { name: "Story Promo", cat: "Sosyal", fmt: "story", bgType: "gradient", c1: "#4c1d95", c2: "#db2777", layers: [
    { text: "YENİ KOLEKSİYON", x: 0.5, y: 0.4, sizePct: 0.075, color: "#ffffff", weight: 800, align: "center", font: 5 },
    { text: "Kaydır → keşfet", x: 0.5, y: 0.85, sizePct: 0.03, color: "#f5d0fe", weight: 500, align: "center", font: 5 },
  ] },
];

/* Hadi Prototip Yapalım — yeni proje başlatma sekmeleri (Claude Design'daki gibi). */
const START_TABS: { id: "prototip" | "sunum" | "sablon" | "bos"; label: string; fmt: string }[] = [
  { id: "prototip", label: "Prototip", fmt: "slide" },
  { id: "sunum", label: "Sunum", fmt: "slide" },
  { id: "sablon", label: "Şablon", fmt: "poster" },
  { id: "bos", label: "Boş", fmt: "square" },
];

const SUGGESTIONS = [
  "API ürünü için hero + fiyatlandırma içeren landing page kapağı tasarla",
  "Mor-amber gradyanlı, ilham verici sözlü minimal sosyal medya gönderisi",
  "Bir kahve markası için sıcak tonlu afiş, başlık ve slogan ile",
  "4 maddeli özellik listesi olan koyu temalı sunum kapağı",
];

/* ---- Yardımcılar (saf) ---- */
async function usableApiKey(model: { apiKey?: string; provider: string }): Promise<string> {
  const cfg = useStore.getState().config;
  let k = model.apiKey || (cfg.providerKeys as Record<string, string> | undefined)?.[model.provider] || "";
  if (k) { k = await decryptField(k); if (isEncrypted(k)) k = ""; }
  return k;
}

function pollUrl(prompt: string, w: number, h: number) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
}

function extractJson(s: string): Record<string, unknown> | null {
  const fence = s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/);
  let raw: string | null = fence ? fence[1] : null;
  if (!raw) { const a = s.indexOf("{"); const b = s.lastIndexOf("}"); if (a >= 0 && b > a) raw = s.slice(a, b + 1); }
  if (!raw) return null;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}
function stripJson(s: string) {
  return s.replace(/```json[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "").trim();
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Renk tonu kaydırma (AI slider için) — hex → HSL → hex. */
function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0; const l = (max + min) / 2;
  const d = max - min; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function shiftHue(hex: string, deg: number): string {
  if (!deg) return hex;
  const [h, s, l] = hexToHsl(hex); return hslToHex((h + deg + 360) % 360, s, l);
}

/* Slider'ları (boşluk/ölçek/renk tonu) uygulanmış GÖRÜNÜM tasarımı türetir.
   Temel tasarımı bozmaz → slider'lar geri alınabilir. */
function applyView(d: Design, spacing: number, scale: number, hue: number): Design {
  return {
    ...d,
    c1: shiftHue(d.c1, hue), c2: shiftHue(d.c2, hue),
    layers: d.layers.map((l) => ({ ...l, y: clamp01(0.5 + (l.y - 0.5) * spacing), size: Math.max(8, Math.round(l.size * scale)) })),
  };
}

export function DesignStudio() {
  const open = useStore((s) => s.designStudioOpen);
  const setOpen = useStore((s) => s.setDesignStudioOpen);
  const setImageStudioOpen = useStore((s) => s.setImageStudioOpen);
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const saved: SavedDesign[] = config.savedDesigns ?? [];
  const [d, setD] = useState<Design>(() => template(FORMATS[0]));
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<"design" | "gallery" | "templates">("design");
  const [genPrompt, setGenPrompt] = useState("");
  const [exporting, setExporting] = useState(false);
  const [title, setTitle] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  // Paneller
  const [chatOpen, setChatOpen] = useState(true);
  const [tweaksOpen, setTweaksOpen] = useState(true);
  const [exportMenu, setExportMenu] = useState(false);

  // Sohbet
  interface Msg { role: "user" | "assistant"; text: string; images?: string[] }
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImgs, setPendingImgs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Proje / kalite
  const [quality, setQuality] = useState<keyof typeof QUALITY>("medium");

  // AI slider'lar
  const [spacing, setSpacing] = useState(1);
  const [scale, setScale] = useState(1);
  const [hue, setHue] = useState(0);

  const vd = useMemo(() => applyView(d, spacing, scale, hue), [d, spacing, scale, hue]);

  if (!open) return null;

  const upLayer = (patch: Partial<Layer>) =>
    setD((p) => ({ ...p, layers: p.layers.map((l, i) => (i === sel ? { ...l, ...patch } : l)) }));
  const addLayer = () =>
    setD((p) => ({ ...p, layers: [...p.layers, { id: uid(), text: "Yeni metin", x: 0.5, y: 0.75, size: Math.round(p.w * 0.03), color: "#ffffff", weight: 600, align: "center", font: FONTS[0] }] }));
  const delLayer = (i: number) => setD((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) }));
  const setFormat = (f: typeof FORMATS[number]) => setD((p) => ({ ...p, fmt: f.id, w: f.w, h: f.h }));

  const startProject = (t: typeof START_TABS[number]) => {
    if (t.id === "sablon") { setView("templates"); return; }
    const f = FORMATS.find((x) => x.id === t.fmt) ?? FORMATS[0];
    setD(template(f, t.id));
    setSel(0); setSpacing(1); setScale(1); setHue(0);
  };

  const applyTemplate = (t: Template) => {
    const f = FORMATS.find((x) => x.id === t.fmt) ?? FORMATS[0];
    setD({
      fmt: f.id, w: f.w, h: f.h, bgType: t.bgType, c1: t.c1, c2: t.c2, bgImage: "",
      layers: t.layers.map((l) => ({ id: uid(), text: l.text, x: l.x, y: l.y, size: Math.round(f.w * l.sizePct), color: l.color, weight: l.weight, align: l.align, font: FONTS[l.font] ?? FONTS[0] })),
    });
    setSel(0); setSpacing(1); setScale(1); setHue(0); setView("design");
  };

  const genBg = () => {
    const p = genPrompt.trim();
    if (!p) return;
    setD((prev) => ({ ...prev, bgType: "image", bgImage: pollUrl(p, prev.w, prev.h) }));
  };

  /* ---- AI ile tasarım üret / değiştir (ücretsiz LLM) ---- */
  const toPartial = (x: Design) => ({
    bgType: x.bgType === "image" ? "gradient" : x.bgType, c1: x.c1, c2: x.c2,
    layers: x.layers.map((l) => ({ text: l.text, x: +l.x.toFixed(2), y: +l.y.toFixed(2), sizePct: +(l.size / x.w).toFixed(3), color: l.color, weight: l.weight, align: l.align, font: Math.max(0, FONTS.indexOf(l.font)) })),
  });

  const applyPartial = (p: Record<string, unknown>) => {
    setD((prev) => {
      const layersRaw = Array.isArray(p.layers) ? (p.layers as Record<string, unknown>[]) : null;
      const bgPrompt = typeof p.bgPrompt === "string" ? p.bgPrompt.trim() : "";
      const layers: Layer[] = layersRaw && layersRaw.length
        ? layersRaw.slice(0, 8).map((l) => ({
            id: uid(),
            text: String(l.text ?? ""),
            x: clamp01(Number(l.x ?? 0.5)),
            y: clamp01(Number(l.y ?? 0.5)),
            size: Math.max(10, Math.round(prev.w * (Number(l.sizePct) || 0.04))),
            color: typeof l.color === "string" ? l.color : "#ffffff",
            weight: Number(l.weight) || 600,
            align: (["left", "center", "right"].includes(String(l.align)) ? l.align : "center") as Align,
            font: FONTS[Number(l.font)] ?? FONTS[0],
          }))
        : prev.layers;
      return {
        ...prev,
        bgType: bgPrompt ? "image" : (p.bgType === "color" ? "color" : "gradient"),
        bgImage: bgPrompt ? pollUrl(bgPrompt, prev.w, prev.h) : "",
        c1: typeof p.c1 === "string" ? p.c1 : prev.c1,
        c2: typeof p.c2 === "string" ? p.c2 : prev.c2,
        layers,
      };
    });
  };

  const DESIGN_SYSTEM = `Sen profesyonel bir grafik/sunum tasarımcısısın. Kullanıcının doğal dildeki isteğine göre TEK bir tasarım üretirsin.

ÇIKTI BİÇİMİ (çok önemli): Önce TEK cümlelik kısa Türkçe açıklama yaz, sonra MUTLAKA aşağıdaki şemada bir \`\`\`json bloğu ver:

\`\`\`json
{ "bgType": "gradient", "c1": "#RRGGBB", "c2": "#RRGGBB", "bgPrompt": "",
  "layers": [ { "text": "Metin", "x": 0.5, "y": 0.4, "sizePct": 0.075, "color": "#RRGGBB", "weight": 800, "align": "center", "font": 2 } ] }
\`\`\`

KURALLAR:
- x,y: 0..1 oran (tuvaldeki konum). y=0 üst, 1 alt. align: left|center|right.
- sizePct = yazıboyu/genişlik. Başlık ~0.06-0.09, alt başlık ~0.03, gövde ~0.022.
- weight 100..900. font: 0=Georgia,1=Arial,2=Impact(başlık),3=Times,4=Courier,5=system-ui.
- Kontrast yüksek, okunaklı olsun (koyu zeminde açık metin).
- Fotoğraf gerekiyorsa kısa İngilizce "bgPrompt" ver (ör: "abstract amber waves, minimal"); doluysa arka plan AI görseliyle üretilir.
- 1-4 katman yeterli; kalabalık yapma. Yalnız şemaya uy.`;

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingImgs.length === 0) || busy) return;
    const userMsg: Msg = { role: "user", text: text || "(görsele göre tasarla)", images: pendingImgs.length ? pendingImgs : undefined };
    const next = [...msgs, userMsg];
    setMsgs([...next, { role: "assistant", text: "" }]);
    setInput(""); const imgs = pendingImgs; setPendingImgs([]); setBusy(true);
    try {
      const cfg = useStore.getState().config;
      const active = useStore.getState().activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const sys = `${DESIGN_SYSTEM}\n\nMevcut tuval: ${d.w}x${d.h} (${d.fmt}). Mevcut tasarım (değişiklik isteniyorsa bunu TEMEL al): ${JSON.stringify(toPartial(d))}`;
      const apiMsgs = next.slice(-6).map((m) => {
        if (m.images?.length) {
          return { role: m.role, content: [{ type: "text", text: m.text }, ...m.images.map((u) => ({ type: "image_url", image_url: { url: u } }))] };
        }
        return { role: m.role, content: m.text };
      });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMsgs,
          baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
          systemPrompt: sys,
          fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
          tools: false, webSearch: false, temperature: 0.7,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = ""; let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const ln of lines) {
          const t = ln.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; const shown = stripJson(full); setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: shown }; return c; }); }
          } catch { /* parça parça JSON; yoksay */ }
        }
      }
      const partial = extractJson(full);
      if (partial) applyPartial(partial);
      const shown = stripJson(full) || (partial ? "Tasarımı güncelledim." : "Yanıt alındı.");
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: shown }; return c; });
      if (!partial) addToast("AI tasarım üretemedi — isteğini biraz daha açık yaz.", "error");
      void imgs;
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${e instanceof Error ? e.message : "bilinmeyen"}` }; return c; });
    } finally { setBusy(false); }
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 3).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setPendingImgs((p) => [...p, String(r.result)].slice(0, 3));
      r.readAsDataURL(f);
    });
  };

  /* ---- Dışa aktarma ---- */
  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });

  const exportPng = async () => {
    setExportMenu(false); setExporting(true);
    try {
      const mult = QUALITY[quality].mult;
      const cv = document.createElement("canvas");
      cv.width = Math.round(vd.w * mult); cv.height = Math.round(vd.h * mult);
      const ctx = cv.getContext("2d")!;
      ctx.scale(mult, mult);
      if (vd.bgType === "image" && vd.bgImage) {
        const img = await loadImg(vd.bgImage); ctx.drawImage(img, 0, 0, vd.w, vd.h);
      } else if (vd.bgType === "color") {
        ctx.fillStyle = vd.c1; ctx.fillRect(0, 0, vd.w, vd.h);
      } else {
        const g = ctx.createLinearGradient(0, 0, vd.w, vd.h); g.addColorStop(0, vd.c1); g.addColorStop(1, vd.c2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, vd.w, vd.h);
      }
      for (const L of vd.layers) {
        ctx.fillStyle = L.color; ctx.textAlign = L.align; ctx.textBaseline = "middle";
        ctx.font = `${L.weight} ${L.size}px ${L.font}`;
        const maxW = vd.w * 0.88; const words = L.text.split(" "); const lines: string[] = []; let cur = "";
        for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
        if (cur) lines.push(cur);
        const lh = L.size * 1.18; const px = vd.w * L.x; let py = vd.h * L.y - ((lines.length - 1) * lh) / 2;
        for (const ln of lines) { ctx.fillText(ln, px, py); py += lh; }
      }
      const blob: Blob | null = await new Promise((r) => cv.toBlob(r, "image/png"));
      if (!blob) throw new Error("boş");
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${(title || "tasarim").replace(/\s+/g, "-")}-${Date.now()}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      addToast("PNG indirilemedi (AI arka plan CORS engelliyor olabilir — gradyan/renk dene)", "error");
    } finally { setExporting(false); }
  };

  const layersHtml = (x: Design) => x.layers.map((l) => {
    const pos = l.align === "left" ? `left:${l.x * 100}%;` : l.align === "right" ? `right:${(1 - l.x) * 100}%;` : "left:50%;";
    const tf = l.align === "center" ? "translate(-50%,-50%)" : "translateY(-50%)";
    const w = l.align === "center" ? "width:88%;" : "";
    return `<div style="position:absolute;${pos}top:${l.y * 100}%;transform:${tf};color:${l.color};font-weight:${l.weight};font-family:${l.font};font-size:${(l.size / x.w * 100).toFixed(3)}cqw;line-height:1.18;text-align:${l.align};max-width:88%;${w}">${escapeHtml(l.text)}</div>`;
  }).join("");

  const bgCss = (x: Design) => x.bgType === "image" && x.bgImage
    ? `background:url('${x.bgImage}') center/cover;`
    : x.bgType === "color" ? `background:${x.c1};` : `background:linear-gradient(135deg,${x.c1},${x.c2});`;

  const exportHtml = () => {
    setExportMenu(false);
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || "Tasarım")}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0d;display:grid;place-items:center;min-height:100vh}.stage{container-type:inline-size;width:min(96vw,960px);aspect-ratio:${vd.w}/${vd.h};position:relative;overflow:hidden;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.5);${bgCss(vd)}}</style></head><body><div class="stage">${layersHtml(vd)}</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(title || "tasarim").replace(/\s+/g, "-")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const exportPdf = () => {
    setExportMenu(false);
    const w = window.open("", "_blank");
    if (!w) { addToast("Açılır pencere engellendi — PDF için açılır pencereye izin ver.", "error"); return; }
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title || "Tasarım")}</title><style>@page{size:${vd.w > vd.h ? "landscape" : "portrait"};margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}body{display:grid;place-items:center}.stage{container-type:inline-size;width:100vw;aspect-ratio:${vd.w}/${vd.h};position:relative;overflow:hidden;${bgCss(vd)}}@media print{.stage{width:100vw}}</style></head><body><div class="stage">${layersHtml(vd)}</div><script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  };

  /* ---- Galeri ---- */
  const save = () => {
    const t = title.trim() || `Tasarım ${saved.length + 1}`;
    const design: SavedDesign = { id: `${Date.now()}`, title: t, code: JSON.stringify(d), createdAt: Date.now() };
    saveConfig({ ...config, savedDesigns: [design, ...saved].slice(0, 100) });
    addToast("Tasarım kaydedildi", "success");
  };
  const load = (sd: SavedDesign) => {
    try { setD(JSON.parse(sd.code) as Design); setTitle(sd.title); setSel(0); setSpacing(1); setScale(1); setHue(0); setView("design"); } catch { /* eski format */ }
  };
  const del = (id: string) => saveConfig({ ...config, savedDesigns: saved.filter((x) => x.id !== id) });

  const L = d.layers[sel] ?? d.layers[0];
  const bgStyle: React.CSSProperties =
    vd.bgType === "image" && vd.bgImage ? { backgroundImage: `url(${vd.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : vd.bgType === "color" ? { background: vd.c1 }
        : { background: `linear-gradient(135deg, ${vd.c1}, ${vd.c2})` };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst araç çubuğu */}
      <div className="brand-rule glass shrink-0 flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand shrink-0"><Sparkles size={16} /></span>
        {/* Stüdyo modu — Tasarım | Görüntü (tek stüdyo) */}
        <div className="flex items-center bg-bgsoft border border-line rounded-lg p-0.5 text-xs font-semibold shrink-0">
          <button className="px-2.5 py-1 rounded-md bg-brand/15 text-brand">Tasarım</button>
          <button onClick={() => { setOpen(false); setImageStudioOpen(true); }} className="px-2.5 py-1 rounded-md text-muted hover:text-ink transition-colors">Görüntü</button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tasarım adı…" className="hidden sm:block ml-2 w-40 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50" />

        {/* Araç anahtarları (Claude Design tarzı segment) */}
        <div className="ml-2 hidden md:flex items-center gap-1 bg-bgsoft border border-line rounded-lg p-0.5">
          <button onClick={() => setChatOpen((v) => !v)} title="Sohbet" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${chatOpen ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}><MessageSquare size={13} /> Sohbet</button>
          <button onClick={() => setTweaksOpen((v) => !v)} title="İyileştirmeler" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${tweaksOpen ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}><Sliders size={13} /> Tweaks</button>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Kalite */}
          <select value={quality} onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY)} title="Çıktı kalitesi" className="hidden sm:block bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand/50 cursor-pointer">
            {Object.entries(QUALITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {/* Dışa aktar menüsü */}
          <div className="relative">
            <button onClick={() => setExportMenu((v) => !v)} disabled={exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors disabled:opacity-50">
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} <span className="hidden sm:inline">İndir</span>
            </button>
            {exportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportMenu(false)} />
                <div className="absolute right-0 mt-1.5 z-20 w-40 bg-surface border border-line rounded-xl shadow-2xl p-1 text-sm">
                  <button onClick={exportPng} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><FileImage size={14} className="text-brand" /> PNG görsel</button>
                  <button onClick={exportHtml} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><FileCode size={14} className="text-brand" /> Bağımsız HTML</button>
                  <button onClick={exportPdf} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><FileText size={14} className="text-brand" /> PDF (yazdır)</button>
                </div>
              </>
            )}
          </div>

          <button onClick={save} className="btn-brand-glow flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-white text-xs font-bold"><Save size={13} /> <span className="hidden sm:inline">Kaydet</span></button>
          <button onClick={() => setView((v) => (v === "templates" ? "design" : "templates"))} title="Hazır şablonlar" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${view === "templates" ? "border-brand/50 text-brand" : "border-line hover:border-brand/40"}`}><LayoutTemplate size={13} /> <span className="hidden sm:inline">Şablon</span></button>
          <button onClick={() => setView((v) => (v === "gallery" ? "design" : "gallery"))} title="Kayıtlı tasarımlar" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${view === "gallery" ? "border-brand/50 text-brand" : "border-line hover:border-brand/40"}`}><LayoutGrid size={13} /> {saved.length}</button>
          <button onClick={() => setOpen(false)} className="w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {view === "templates" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-3">
              <div className="text-sm font-bold">Hazır şablonlar</div>
              <div className="text-[11px] text-muted/60">Bir şablona dokun, hemen düzenlemeye başla. Sohbetten de değiştirebilirsin.</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {TEMPLATES.map((t) => {
                const f = FORMATS.find((x) => x.id === t.fmt) ?? FORMATS[0];
                const bg = t.bgType === "color" ? { background: t.c1 } : { background: `linear-gradient(135deg, ${t.c1}, ${t.c2})` };
                const top = t.layers[0];
                return (
                  <button key={t.name} onClick={() => applyTemplate(t)} className="premium-card rounded-2xl overflow-hidden group/t text-left hover:border-brand/40 transition-colors">
                    <div className="relative grid place-items-center px-3 text-center overflow-hidden" style={{ ...bg, aspectRatio: `${f.w} / ${f.h}` }}>
                      <span className="font-bold leading-tight text-[11px] sm:text-xs line-clamp-3" style={{ color: top.color, fontFamily: FONTS[top.font] }}>{top.text}</span>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold truncate">{t.name}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-brand/70 bg-brand/10 px-1.5 py-0.5 rounded shrink-0">{t.cat}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : view === "gallery" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {saved.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted/50">Henüz kayıtlı tasarım yok.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {saved.map((sd) => {
                  let dd: Design | null = null; try { dd = JSON.parse(sd.code) as Design; } catch { /* yok */ }
                  return (
                    <div key={sd.id} className="relative premium-card rounded-2xl overflow-hidden group/d">
                      <button onClick={() => load(sd)} className="block w-full text-left">
                        <div className="aspect-[4/3] grid place-items-center text-white text-xs font-bold" style={dd ? (dd.bgType === "image" && dd.bgImage ? { backgroundImage: `url(${dd.bgImage})`, backgroundSize: "cover" } : dd.bgType === "color" ? { background: dd.c1 } : { background: `linear-gradient(135deg, ${dd.c1}, ${dd.c2})` }) : {}}>
                          {dd?.layers[0]?.text}
                        </div>
                        <div className="px-3 py-2 text-[12px] font-semibold truncate">{sd.title}</div>
                      </button>
                      <button onClick={() => del(sd.id)} className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-lg bg-bg/70 backdrop-blur text-ink/70 hover:text-red opacity-0 group-hover/d:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* SOL — Sohbet paneli */}
            {chatOpen && (
              <div className="w-full sm:w-80 h-[44%] sm:h-auto shrink-0 border-b sm:border-b-0 sm:border-r border-line/60 flex flex-col bg-surface/40">
                <div className="px-3 pt-3 pb-2 border-b border-line/50">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Hadi tasarlayalım</div>
                  <div className="grid grid-cols-4 gap-1">
                    {START_TABS.map((t) => (
                      <button key={t.id} onClick={() => startProject(t)} className="px-1.5 py-1.5 rounded-lg border border-line/60 hover:border-brand/50 text-[11px] font-semibold text-muted hover:text-ink transition-colors">{t.label}</button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {msgs.length === 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted/60 leading-relaxed">Ne tasarlamak istediğini yaz — başlık, düzen, renk, hedef kitle ne kadar net olursa o kadar iyi. İstersen görsel de ekle.</div>
                      {SUGGESTIONS.map((s) => (
                        <button key={s} onClick={() => setInput(s)} className="w-full text-left text-[12px] leading-snug px-2.5 py-2 rounded-xl border border-line/60 hover:border-brand/50 hover:bg-bgsoft/60 text-muted hover:text-ink transition-colors">{s}</button>
                      ))}
                    </div>
                  ) : msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-brand/15 border border-brand/25 text-ink" : "bg-bgsoft border border-line/60 text-muted"}`}>
                        {m.images?.length ? <div className="flex gap-1 mb-1.5 flex-wrap">{m.images.map((u, j) => <span key={j} className="w-12 h-12 rounded-lg border border-line bg-cover bg-center" style={{ backgroundImage: `url(${u})` }} />)}</div> : null}
                        {m.role === "assistant" && !m.text && busy ? <Loader2 size={14} className="animate-spin text-brand" /> : (m.text || "…")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Görsel ekleri */}
                {pendingImgs.length > 0 && (
                  <div className="px-3 pb-1 flex gap-1.5">
                    {pendingImgs.map((u, i) => (
                      <div key={i} className="relative">
                        <span className="block w-10 h-10 rounded-lg border border-line bg-cover bg-center" style={{ backgroundImage: `url(${u})` }} />
                        <button onClick={() => setPendingImgs((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-4 h-4 grid place-items-center rounded-full bg-bg border border-line text-muted hover:text-red"><X size={9} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2.5 border-t border-line/50">
                  <div className="flex items-end gap-1.5 bg-bgsoft border border-line rounded-xl px-2 py-1.5 focus-within:border-brand/50 transition-colors">
                    <button onClick={() => fileRef.current?.click()} title="Görsel ekle (bağlam)" className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-brand transition-colors"><Upload size={15} /></button>
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
                    <textarea
                      value={input} onChange={(e) => setInput(e.target.value)} rows={1}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                      placeholder="Tasarım iste veya değişiklik söyle…"
                      className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24 py-1"
                    />
                    <button onClick={() => void send()} disabled={busy} className="shrink-0 w-7 h-7 grid place-items-center rounded-lg bg-brand text-white disabled:opacity-50 transition-opacity">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ORTA — Tuval */}
            <div className="flex-1 min-h-0 grid place-items-center p-4 sm:p-8 overflow-auto bg-[#0a0a0d]">
              <div ref={previewRef} className="relative shadow-2xl rounded-sm overflow-hidden" style={{ ...bgStyle, width: "min(100%, 640px)", aspectRatio: `${vd.w} / ${vd.h}` }}>
                {vd.layers.map((ly, i) => (
                  <div
                    key={ly.id}
                    onClick={() => setSel(i)}
                    className={`absolute cursor-pointer px-2 transition-[outline] ${i === sel ? "outline outline-1 outline-brand/60" : "hover:outline hover:outline-1 hover:outline-brand/30"}`}
                    style={{
                      left: ly.align === "left" ? `${ly.x * 100}%` : ly.align === "right" ? undefined : "50%",
                      right: ly.align === "right" ? `${(1 - ly.x) * 100}%` : undefined,
                      top: `${ly.y * 100}%`,
                      transform: ly.align === "center" ? "translate(-50%,-50%)" : "translateY(-50%)",
                      color: ly.color,
                      fontSize: `calc(${ly.size} / ${vd.w} * min(100%, 640px))`,
                      fontWeight: ly.weight, fontFamily: ly.font, textAlign: ly.align,
                      width: ly.align === "center" ? "88%" : "auto", maxWidth: "88%", lineHeight: 1.18,
                    }}
                  >
                    {ly.text}
                  </div>
                ))}
              </div>
            </div>

            {/* SAĞ — Tweaks paneli */}
            {tweaksOpen && (
              <div className="w-72 shrink-0 border-l border-line/60 overflow-y-auto p-4 space-y-4 bg-surface/30 hidden sm:block">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Boyut</div>
                  <select value={d.fmt} onChange={(e) => setFormat(FORMATS.find((f) => f.id === e.target.value)!)} className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-sm outline-none focus:border-brand/50 cursor-pointer">
                    {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.w}×{f.h}</option>)}
                  </select>
                </div>

                {/* AI slider'lar */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><Sliders size={11} /> AI ayarları</div>
                  <div className="space-y-2.5">
                    <label className="block text-[11px] text-muted/70">Boşluk
                      <input type="range" min={0.6} max={1.4} step={0.02} value={spacing} onChange={(e) => setSpacing(+e.target.value)} className="w-full accent-brand" />
                    </label>
                    <label className="block text-[11px] text-muted/70">Yazı ölçeği
                      <input type="range" min={0.7} max={1.3} step={0.02} value={scale} onChange={(e) => setScale(+e.target.value)} className="w-full accent-brand" />
                    </label>
                    <label className="block text-[11px] text-muted/70">Renk tonu
                      <input type="range" min={-60} max={60} step={2} value={hue} onChange={(e) => setHue(+e.target.value)} className="w-full accent-brand" />
                    </label>
                    {(spacing !== 1 || scale !== 1 || hue !== 0) && (
                      <button onClick={() => { setSpacing(1); setScale(1); setHue(0); }} className="text-[11px] text-muted hover:text-ink underline">Sıfırla</button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5">Arka plan teması</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p.name} onClick={() => setD((prev) => ({ ...prev, bgType: "gradient", c1: p.c1, c2: p.c2 }))} title={p.name} className="h-8 rounded-lg border border-line/60 hover:border-brand transition-colors" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="color" value={d.c1} onChange={(e) => setD((p) => ({ ...p, c1: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 1" />
                    <input type="color" value={d.c2} onChange={(e) => setD((p) => ({ ...p, c2: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 2" />
                    <button onClick={() => setD((p) => ({ ...p, bgType: p.bgType === "color" ? "gradient" : "color" }))} className="text-[11px] px-2 py-1 rounded border border-line text-muted hover:text-ink">{d.bgType === "color" ? "Düz" : "Gradyan"}</button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><ImageIcon size={11} /> AI arka plan (ücretsiz)</div>
                  <textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} rows={2} placeholder="ör: minimal soyut amber dalgalar" className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand/50 resize-none" />
                  <button onClick={genBg} className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors"><Wand2 size={13} className="text-brand" /> Arka plan üret</button>
                </div>

                {/* Katmanlar / doğrudan düzenleme */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Type size={11} /> Metin katmanları</span>
                    <button onClick={addLayer} className="text-brand hover:text-branddim"><Plus size={13} /></button>
                  </div>
                  <div className="space-y-1 mb-2">
                    {d.layers.map((ly, i) => (
                      <div key={ly.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer text-xs ${i === sel ? "bg-brand/10 text-brand" : "text-muted hover:bg-bgsoft/60"}`} onClick={() => setSel(i)}>
                        <span className="flex-1 truncate">{ly.text || "(boş)"}</span>
                        {d.layers.length > 1 && <button onClick={(e) => { e.stopPropagation(); delLayer(i); setSel(0); }} className="text-muted/50 hover:text-red"><Trash2 size={11} /></button>}
                      </div>
                    ))}
                    {d.layers.length === 0 && <div className="text-[11px] text-muted/50 px-2 py-1">Katman yok — sohbetten üret ya da + ile ekle.</div>}
                  </div>
                  {L && (
                    <div className="space-y-2 border-t border-line/40 pt-2">
                      <textarea value={L.text} onChange={(e) => upLayer({ text: e.target.value })} rows={2} className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none" />
                      <div className="flex items-center gap-2">
                        <input type="color" value={L.color} onChange={(e) => upLayer({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                        <input type="range" min={16} max={Math.round(d.w * 0.14)} value={L.size} onChange={(e) => upLayer({ size: +e.target.value })} className="flex-1 accent-brand" />
                      </div>
                      <select value={L.font} onChange={(e) => upLayer({ font: e.target.value })} className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer">
                        {FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</option>)}
                      </select>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as Align[]).map((a) => (
                          <button key={a} onClick={() => upLayer({ align: a })} className={`flex-1 py-1 rounded text-[11px] border ${L.align === a ? "border-brand text-brand" : "border-line text-muted"}`}>{a === "left" ? "Sol" : a === "center" ? "Orta" : "Sağ"}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted/60">
                        <span>Y:</span>
                        <input type="range" min={0} max={1} step={0.01} value={L.y} onChange={(e) => upLayer({ y: +e.target.value })} className="flex-1 accent-brand" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
