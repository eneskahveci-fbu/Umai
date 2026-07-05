"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, ExternalLink, FileCode, FileImage, FileText, Image as ImageIcon, LayoutGrid, LayoutTemplate, Loader2,
  MessageSquare, MoreHorizontal, Plus, Redo2, RotateCw, Save, Send, Sliders, Sparkles, Trash2, Type, Undo2, Upload, Wand2, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSurfaceNav } from "@/lib/surfaceNav";
import { StudioSwitcher } from "./studio/StudioSwitcher";
import { ExportMenu } from "./studio/ExportMenu";
import { decryptField, isEncrypted } from "@/lib/secureKeys";
import { buildFallbackChain } from "@/lib/fallback";
import { buildSingleBlockPreview, parseBlocks } from "@/lib/preview";
import { clamp01, clonePages, emptyHist, nudge, pushHist, redoHist, undoHist } from "@/lib/design";
import type { Align, Design, HistState, ImgLayer, Layer } from "@/lib/design";
import type { SavedDesign } from "@/lib/types";

/* Tasarım Stüdyosu — Claude Design + Canva hibrit editör (craft teması).
   Sol: doğal dille sohbet (ÜCRETSİZ LLM ile tasarım üret/değiştir + görsel bağlam).
   Orta: canlı tuval — eleman sürükle/boyutlandır, çift-tık ile yerinde metin
   düzenleme, seçili elemanı AI ile değiştirme, undo/redo + kısayollar, zoom.
   Sağ: Tweaks (boyut/arka plan/katman) + AI slider'lar. Dışa aktarma: PNG·HTML·PDF.
   Tüm AI çağrıları anahtarsız Pollinations tabanına düşer → maliyetsiz. */

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

  // ── Slaytlar (sunum) ──────────────────────────────────────────────
  { name: "Bölüm Başlığı", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#0f172a", c2: "#334155", layers: [
    { text: "01", x: 0.08, y: 0.34, sizePct: 0.12, color: "#38bdf8", weight: 800, align: "left", font: 5 },
    { text: "Bölüm Başlığı", x: 0.08, y: 0.52, sizePct: 0.06, color: "#f1f5f9", weight: 800, align: "left", font: 5 },
    { text: "kısa açıklama satırı", x: 0.08, y: 0.62, sizePct: 0.026, color: "#94a3b8", weight: 400, align: "left", font: 5 },
  ] },
  { name: "Ajanda", cat: "Sunum", fmt: "slide", bgType: "color", c1: "#fafaf9", c2: "#fafaf9", layers: [
    { text: "Ajanda", x: 0.08, y: 0.2, sizePct: 0.06, color: "#1c1917", weight: 800, align: "left", font: 5 },
    { text: "1 · Giriş", x: 0.1, y: 0.4, sizePct: 0.034, color: "#44403c", weight: 600, align: "left", font: 5 },
    { text: "2 · Problem ve çözüm", x: 0.1, y: 0.52, sizePct: 0.034, color: "#44403c", weight: 600, align: "left", font: 5 },
    { text: "3 · Sonuç", x: 0.1, y: 0.64, sizePct: 0.034, color: "#44403c", weight: 600, align: "left", font: 5 },
  ] },
  { name: "İstatistik", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#064e3b", c2: "#10b981", layers: [
    { text: "%87", x: 0.5, y: 0.42, sizePct: 0.16, color: "#ecfdf5", weight: 800, align: "center", font: 2 },
    { text: "kullanıcı memnuniyeti", x: 0.5, y: 0.62, sizePct: 0.034, color: "#a7f3d0", weight: 500, align: "center", font: 5 },
  ] },
  { name: "Alıntı Slaytı", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#1e1b4b", c2: "#4338ca", layers: [
    { text: "Basit olan ölçeklenir.", x: 0.5, y: 0.44, sizePct: 0.055, color: "#eef2ff", weight: 700, align: "center", font: 3 },
    { text: "— Anonim", x: 0.5, y: 0.6, sizePct: 0.028, color: "#c7d2fe", weight: 500, align: "center", font: 3 },
  ] },
  { name: "Teşekkürler", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#7c2d12", c2: "#ea580c", layers: [
    { text: "Teşekkürler", x: 0.5, y: 0.44, sizePct: 0.085, color: "#fff7ed", weight: 800, align: "center", font: 5 },
    { text: "sorular & iletişim · @hesap", x: 0.5, y: 0.6, sizePct: 0.028, color: "#fed7aa", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Pitch Kapağı", cat: "Sunum", fmt: "slide", bgType: "color", c1: "#0a0a0a", c2: "#0a0a0a", layers: [
    { text: "STARTUP ADI", x: 0.5, y: 0.4, sizePct: 0.075, color: "#ffffff", weight: 800, align: "center", font: 2 },
    { text: "tek cümlelik değer önerisi", x: 0.5, y: 0.54, sizePct: 0.03, color: "#a3a3a3", weight: 400, align: "center", font: 5 },
    { text: "Seri A · 2025", x: 0.5, y: 0.86, sizePct: 0.022, color: "#737373", weight: 500, align: "center", font: 4 },
  ] },
  { name: "Karşılaştırma", cat: "Sunum", fmt: "slide", bgType: "gradient", c1: "#1e293b", c2: "#0f172a", layers: [
    { text: "Önce vs Sonra", x: 0.5, y: 0.18, sizePct: 0.05, color: "#f8fafc", weight: 800, align: "center", font: 5 },
    { text: "Önce", x: 0.27, y: 0.55, sizePct: 0.045, color: "#fca5a5", weight: 700, align: "center", font: 5 },
    { text: "Sonra", x: 0.73, y: 0.55, sizePct: 0.045, color: "#86efac", weight: 700, align: "center", font: 5 },
  ] },
  { name: "Ders Slaytı", cat: "Sunum", fmt: "slide", bgType: "color", c1: "#1e3a8a", c2: "#1e3a8a", layers: [
    { text: "Ders 1", x: 0.08, y: 0.22, sizePct: 0.03, color: "#93c5fd", weight: 700, align: "left", font: 5 },
    { text: "Konu Başlığı", x: 0.08, y: 0.34, sizePct: 0.06, color: "#eff6ff", weight: 800, align: "left", font: 5 },
    { text: "• madde bir   • madde iki   • madde üç", x: 0.08, y: 0.58, sizePct: 0.028, color: "#bfdbfe", weight: 400, align: "left", font: 5 },
  ] },

  // ── Afişler (poster) ──────────────────────────────────────────────
  { name: "Konferans", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#0c4a6e", c2: "#0891b2", layers: [
    { text: "TECH KONF 2025", x: 0.5, y: 0.22, sizePct: 0.072, color: "#ecfeff", weight: 800, align: "center", font: 2 },
    { text: "Yapay Zekâ & Gelecek", x: 0.5, y: 0.34, sizePct: 0.034, color: "#a5f3fc", weight: 500, align: "center", font: 5 },
    { text: "12-13 Eylül", x: 0.5, y: 0.7, sizePct: 0.05, color: "#ffffff", weight: 700, align: "center", font: 5 },
    { text: "İstanbul · konf.com", x: 0.5, y: 0.8, sizePct: 0.03, color: "#cffafe", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Atölye", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#831843", c2: "#db2777", layers: [
    { text: "ATÖLYE", x: 0.5, y: 0.2, sizePct: 0.09, color: "#fdf2f8", weight: 800, align: "center", font: 2 },
    { text: "Yaratıcı Tasarım", x: 0.5, y: 0.33, sizePct: 0.04, color: "#fbcfe8", weight: 600, align: "center", font: 5 },
    { text: "Cumartesi · 14:00", x: 0.5, y: 0.72, sizePct: 0.04, color: "#ffffff", weight: 700, align: "center", font: 5 },
    { text: "Ücretsiz · kayıt zorunlu", x: 0.5, y: 0.8, sizePct: 0.028, color: "#fce7f3", weight: 400, align: "center", font: 5 },
  ] },
  { name: "İş İlanı", cat: "Afiş", fmt: "poster", bgType: "color", c1: "#111827", c2: "#111827", layers: [
    { text: "İŞ İLANI", x: 0.5, y: 0.16, sizePct: 0.045, color: "#60a5fa", weight: 700, align: "center", font: 5 },
    { text: "Frontend Geliştirici", x: 0.5, y: 0.4, sizePct: 0.06, color: "#f9fafb", weight: 800, align: "center", font: 5 },
    { text: "React · TypeScript · Uzaktan", x: 0.5, y: 0.52, sizePct: 0.03, color: "#9ca3af", weight: 400, align: "center", font: 5 },
    { text: "Başvur → kariyer.com", x: 0.5, y: 0.84, sizePct: 0.032, color: "#60a5fa", weight: 600, align: "center", font: 5 },
  ] },
  { name: "Restoran", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#1c1917", c2: "#78350f", layers: [
    { text: "Lezzet Durağı", x: 0.5, y: 0.24, sizePct: 0.062, color: "#fef3c7", weight: 700, align: "center", font: 3 },
    { text: "AÇILDIK", x: 0.5, y: 0.46, sizePct: 0.09, color: "#fbbf24", weight: 800, align: "center", font: 2 },
    { text: "Her gün 10:00 — 23:00", x: 0.5, y: 0.74, sizePct: 0.03, color: "#fde68a", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Konser", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#18181b", c2: "#7c3aed", layers: [
    { text: "CANLI KONSER", x: 0.5, y: 0.2, sizePct: 0.06, color: "#faf5ff", weight: 800, align: "center", font: 2 },
    { text: "Sahne Adı", x: 0.5, y: 0.46, sizePct: 0.085, color: "#c4b5fd", weight: 800, align: "center", font: 5 },
    { text: "30 Ağustos · 21:00", x: 0.5, y: 0.74, sizePct: 0.038, color: "#ffffff", weight: 700, align: "center", font: 5 },
    { text: "Biletler · bilet.com", x: 0.5, y: 0.82, sizePct: 0.026, color: "#ddd6fe", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Fitness", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#052e16", c2: "#65a30d", layers: [
    { text: "FORMDA KAL", x: 0.5, y: 0.22, sizePct: 0.08, color: "#f7fee7", weight: 800, align: "center", font: 2 },
    { text: "Yeni dönem kayıtları", x: 0.5, y: 0.35, sizePct: 0.032, color: "#d9f99d", weight: 500, align: "center", font: 5 },
    { text: "%40 İNDİRİM", x: 0.5, y: 0.7, sizePct: 0.055, color: "#ffffff", weight: 800, align: "center", font: 2 },
    { text: "salon.com", x: 0.5, y: 0.8, sizePct: 0.028, color: "#ecfccb", weight: 400, align: "center", font: 5 },
  ] },
  { name: "Emlak", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#0c0a09", c2: "#1c1917", layers: [
    { text: "SATILIK", x: 0.5, y: 0.18, sizePct: 0.05, color: "#d6d3d1", weight: 700, align: "center", font: 5 },
    { text: "3+1 Daire", x: 0.5, y: 0.42, sizePct: 0.08, color: "#fafaf9", weight: 800, align: "center", font: 3 },
    { text: "Merkezde · Geniş · Asansörlü", x: 0.5, y: 0.54, sizePct: 0.028, color: "#a8a29e", weight: 400, align: "center", font: 5 },
    { text: "0500 000 00 00", x: 0.5, y: 0.84, sizePct: 0.04, color: "#fbbf24", weight: 700, align: "center", font: 5 },
  ] },
  { name: "Film Gecesi", cat: "Afiş", fmt: "poster", bgType: "gradient", c1: "#450a0a", c2: "#dc2626", layers: [
    { text: "FİLM GECESİ", x: 0.5, y: 0.22, sizePct: 0.07, color: "#fef2f2", weight: 800, align: "center", font: 2 },
    { text: "Açık hava sineması", x: 0.5, y: 0.34, sizePct: 0.032, color: "#fecaca", weight: 500, align: "center", font: 5 },
    { text: "Cuma · 20:30", x: 0.5, y: 0.74, sizePct: 0.044, color: "#ffffff", weight: 700, align: "center", font: 5 },
  ] },

  // ── Sosyal ekstra ─────────────────────────────────────────────────
  { name: "Duyuru", cat: "Sosyal", fmt: "square", bgType: "gradient", c1: "#0ea5e9", c2: "#2563eb", layers: [
    { text: "ÖNEMLİ DUYURU", x: 0.5, y: 0.4, sizePct: 0.06, color: "#ffffff", weight: 800, align: "center", font: 5 },
    { text: "detaylar açıklamada 👇", x: 0.5, y: 0.56, sizePct: 0.032, color: "#dbeafe", weight: 500, align: "center", font: 5 },
  ] },
  { name: "İpucu", cat: "Sosyal", fmt: "square", bgType: "color", c1: "#fafaf9", c2: "#fafaf9", layers: [
    { text: "💡 Günün İpucu", x: 0.5, y: 0.34, sizePct: 0.05, color: "#1c1917", weight: 800, align: "center", font: 5 },
    { text: "Kısa, faydalı bir öneri buraya gelir.", x: 0.5, y: 0.52, sizePct: 0.034, color: "#57534e", weight: 500, align: "center", font: 5 },
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

/* /api/chat SSE akışını okur; her delta'da birikmiş TAM metni bildirir. */
async function readSse(res: Response, onFull?: (full: string) => void): Promise<string> {
  const reader = res.body!.getReader(); const dec = new TextDecoder();
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
        if (delta) { full += delta; onFull?.(full); }
      } catch { /* parça parça JSON; yoksay */ }
    }
  }
  return full;
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
  const nav = useSurfaceNav();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const addToast = useStore((s) => s.addToast);

  const saved: SavedDesign[] = config.savedDesigns ?? [];
  /* Çok-sayfalı belge (Canva tarzı slayt/sayfa). `d` = aktif sayfa, `setD` aktif
     sayfayı günceller → mevcut tüm kullanımlar değişmeden çalışır. */
  const [pages, setPages] = useState<Design[]>(() => [template(FORMATS[0])]);
  const [pageIndexRaw, setPageIndexRaw] = useState(0);
  /* Geçmiş (undo/redo) — commit() değişiklik ÖNCESİ durumu kaydeder. */
  const [hist, setHist] = useState<HistState>(emptyHist());
  const commit = () => setHist((h) => pushHist(h, pages));
  const pageIdx = Math.min(pageIndexRaw, pages.length - 1);
  const d = pages[pageIdx];
  const setD = (u: Design | ((p: Design) => Design)) =>
    setPages((ps) => ps.map((p, i) => (i === pageIdx ? (typeof u === "function" ? (u as (p: Design) => Design)(p) : u) : p)));
  const setPageIndex = (i: number) => setPageIndexRaw(Math.max(0, Math.min(pages.length - 1, i)));
  const resetDoc = (designs: Design[]) => { setPages(designs.length ? designs : [template(FORMATS[0])]); setPageIndexRaw(0); setHist(emptyHist()); };
  const addPage = () => { commit(); const f = FORMATS.find((x) => x.id === d.fmt) ?? FORMATS[0]; setPages((ps) => [...ps, { ...template(f, "bos"), c1: d.c1, c2: d.c2, bgType: d.bgType }]); setPageIndexRaw(pages.length); };
  const dupPage = () => {
    commit();
    const copy = JSON.parse(JSON.stringify(d)) as Design;
    copy.layers = copy.layers.map((l) => ({ ...l, id: uid() }));
    if (copy.images) copy.images = copy.images.map((im) => ({ ...im, id: uid() }));
    setPages((ps) => { const n = [...ps]; n.splice(pageIdx + 1, 0, copy); return n; });
    setPageIndexRaw(pageIdx + 1);
  };
  const delPage = () => { if (pages.length <= 1) return; commit(); setPages((ps) => ps.filter((_, i) => i !== pageIdx)); setPageIndexRaw(Math.max(0, pageIdx - 1)); };
  /* Seçim: -1 = seçim yok. Metin (indeks) ve görsel (id) seçimi birbirini dışlar. */
  const [sel, setSel] = useState(-1);
  const [selImg, setSelImg] = useState<string | null>(null);
  const [editing, setEditing] = useState(-1); // çift-tık yerinde metin düzenleme
  const [zoom, setZoom] = useState(0); // 0 = sığdır, aksi ölçek çarpanı
  const [view, setView] = useState<"design" | "gallery" | "templates">("design");
  const [tplCat, setTplCat] = useState<"Hepsi" | "Sunum" | "Afiş" | "Sosyal">("Hepsi");
  const [genPrompt, setGenPrompt] = useState("");
  const [exporting, setExporting] = useState(false);
  const [title, setTitle] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  // (a) Kod tasarımı modu — sohbetle HTML/React üret, canlı render (preview.ts).
  const [dmode, setDmode] = useState<"canvas" | "code">("canvas");
  const [codeArt, setCodeArt] = useState<{ type: string; content: string } | null>(null);
  const [codeView, setCodeView] = useState<"preview" | "code">("preview");
  const [codeReload, setCodeReload] = useState(0);

  // Paneller
  const [chatOpen, setChatOpen] = useState(true);
  /* Masaüstünde sağ sütun açık; mobilde bottom sheet varsayılan KAPALI
     (açılışta tuvalin %60'ını kaplamasın — ⋯ menüden açılır). */
  const [tweaksOpen, setTweaksOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 640 : true));
  const [studioMenu, setStudioMenu] = useState(false);

  // Sohbet
  interface Msg { role: "user" | "assistant"; text: string; images?: string[] }
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImgs, setPendingImgs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgLayerRef = useRef<HTMLInputElement>(null);

  // Proje / kalite
  const [quality, setQuality] = useState<keyof typeof QUALITY>("medium");

  // AI slider'lar
  const [spacing, setSpacing] = useState(1);
  const [scale, setScale] = useState(1);
  const [hue, setHue] = useState(0);

  // Seçili elemanı AI ile düzenleme (yüzen araç çubuğu)
  const [aiSelOpen, setAiSelOpen] = useState(false);
  const [aiSelText, setAiSelText] = useState("");
  const [aiSelBusy, setAiSelBusy] = useState(false);

  /* Sürükleme/boyutlandırma durumu — render tetiklemez, pointer olayları arası taşınır. */
  const dragRef = useRef<null | {
    kind: "text" | "tsize" | "img" | "isize"; i: number; id: string;
    sx: number; sy: number; ox: number; oy: number; osize: number; ow: number;
    rw: number; rh: number; moved: boolean; snap: Design[];
  }>(null);
  const editSnapRef = useRef<Design[] | null>(null); // yerinde düzenleme başlangıç anlık görüntüsü
  const editCancelRef = useRef(false);
  const stageWrapRef = useRef<HTMLDivElement>(null);

  const vd = useMemo(() => applyView(d, spacing, scale, hue), [d, spacing, scale, hue]);

  const clearSel = () => { setSel(-1); setSelImg(null); setEditing(-1); setAiSelOpen(false); };
  const doUndo = () => { const r = undoHist(hist, pages); if (!r) return; setHist(r.hist); setPages(r.pages); setPageIndexRaw((i) => Math.min(i, r.pages.length - 1)); clearSel(); };
  const doRedo = () => { const r = redoHist(hist, pages); if (!r) return; setHist(r.hist); setPages(r.pages); setPageIndexRaw((i) => Math.min(i, r.pages.length - 1)); clearSel(); };

  /* Klavye kısayolları (tuval modunda): Ctrl+Z/Y geri al-yinele, Delete sil,
     oklar taşı (Shift=5x), Ctrl+D çoğalt, Escape seçim bırak. */
  useEffect(() => {
    if (!open || view !== "design" || dmode !== "canvas") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
      if (e.key === "Escape") { clearSel(); return; }
      if (mod && e.key.toLowerCase() === "d" && sel >= 0 && d.layers[sel]) {
        e.preventDefault(); commit();
        const src = d.layers[sel];
        setD((p) => ({ ...p, layers: [...p.layers, { ...src, id: uid(), x: clamp01(src.x + 0.03), y: clamp01(src.y + 0.03) }] }));
        setSel(d.layers.length); return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selImg) { e.preventDefault(); delImage(selImg); setSelImg(null); }
        else if (sel >= 0 && d.layers[sel]) { e.preventDefault(); delLayer(sel); setSel(-1); }
        return;
      }
      const step = e.shiftKey ? 0.05 : 0.01;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const mv = arrows[e.key];
      if (mv) {
        e.preventDefault(); commit();
        if (selImg) { const im = (d.images ?? []).find((x) => x.id === selImg); if (im) updImage(selImg, nudge(im, mv[0], mv[1])); }
        else if (sel >= 0 && d.layers[sel]) upLayerAt(sel, nudge(d.layers[sel], mv[0], mv[1]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* Ctrl+tekerlek ile zoom — pasif olmayan dinleyici gerekir (preventDefault). */
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.max(0.5, Math.min(3, +((z || 1) + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  if (!open) return null;

  const upLayerAt = (i: number, patch: Partial<Layer>) =>
    setD((p) => ({ ...p, layers: p.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const upLayer = (patch: Partial<Layer>) => upLayerAt(sel, patch);
  const addLayer = (x = 0.5, y = 0.75) => {
    commit();
    setD((p) => ({ ...p, layers: [...p.layers, { id: uid(), text: "Yeni metin", x, y, size: Math.round(p.w * 0.03), color: "#ffffff", weight: 600, align: "center", font: FONTS[0] }] }));
    setSel(d.layers.length); setSelImg(null);
  };
  const delLayer = (i: number) => { commit(); setD((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) })); };
  const setFormat = (f: typeof FORMATS[number]) => { commit(); setD((p) => ({ ...p, fmt: f.id, w: f.w, h: f.h })); };

  /* (c1) Görsel/logo katmanı yardımcıları. */
  const addImage = (src: string) => { commit(); setD((p) => ({ ...p, images: [...(p.images ?? []), { id: uid(), src, x: 0.5, y: 0.5, w: 0.3 }] })); };
  const updImage = (id: string, patch: Partial<ImgLayer>) => setD((p) => ({ ...p, images: (p.images ?? []).map((im) => (im.id === id ? { ...im, ...patch } : im)) }));
  const delImage = (id: string) => { commit(); setD((p) => ({ ...p, images: (p.images ?? []).filter((im) => im.id !== id) })); };
  const pickImageLayer = (file: File) => { const r = new FileReader(); r.onload = () => addImage(String(r.result)); r.readAsDataURL(file); };

  /* ---- Tuvalde doğrudan manipülasyon: sürükle / boyutlandır ---- */
  const startDrag = (e: React.PointerEvent, t: { kind: "text" | "tsize"; i: number } | { kind: "img" | "isize"; id: string }) => {
    e.stopPropagation();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    let ox = 0, oy = 0, osize = 0, ow = 0, i = -1, id = "";
    if ("i" in t) {
      const ly = d.layers[t.i]; if (!ly) return;
      i = t.i; ox = ly.x; oy = ly.y; osize = ly.size;
      setSel(t.i); setSelImg(null);
    } else {
      const im = (d.images ?? []).find((x) => x.id === t.id); if (!im) return;
      id = t.id; ox = im.x; oy = im.y; ow = im.w;
      setSelImg(t.id); setSel(-1);
    }
    setAiSelOpen(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind: t.kind, i, id, sx: e.clientX, sy: e.clientY, ox, oy, osize, ow, rw: rect.width, rh: rect.height, moved: false, snap: clonePages(pages) };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const g = dragRef.current;
    if (!g) return;
    const dx = (e.clientX - g.sx) / g.rw, dy = (e.clientY - g.sy) / g.rh;
    if (!g.moved && Math.abs(dx) + Math.abs(dy) < 0.004) return;
    g.moved = true;
    /* Boşluk slider'ı görünümde y'yi 0.5 merkezli ölçekler → taban delta = dy/spacing. */
    if (g.kind === "text") upLayerAt(g.i, { x: clamp01(g.ox + dx), y: clamp01(g.oy + dy / (spacing || 1)) });
    else if (g.kind === "tsize") upLayerAt(g.i, { size: Math.max(10, Math.round(g.osize * Math.max(0.2, 1 + dx * 2))) });
    else if (g.kind === "img") updImage(g.id, { x: clamp01(g.ox + dx), y: clamp01(g.oy + dy) });
    else updImage(g.id, { w: Math.max(0.05, Math.min(1, g.ow + dx * 2)) });
  };
  const endDrag = () => {
    const g = dragRef.current;
    dragRef.current = null;
    if (g?.moved) setHist((h) => pushHist(h, g.snap));
  };

  /* ---- Çift-tık yerinde metin düzenleme ---- */
  const startEdit = (i: number) => {
    editSnapRef.current = clonePages(pages); editCancelRef.current = false;
    setEditing(i); setSel(i); setSelImg(null); setAiSelOpen(false);
  };
  const endEdit = (keep: boolean) => {
    const snap = editSnapRef.current;
    editSnapRef.current = null; editCancelRef.current = false;
    if (editing < 0) return;
    setEditing(-1);
    if (!snap) return;
    if (keep) { if (JSON.stringify(snap) !== JSON.stringify(pages)) setHist((h) => pushHist(h, snap)); }
    else setPages(snap);
  };

  /* "Sunum" → GERÇEK 4 slaytlık iskelet (kapak · ajanda · içerik · teşekkür).
     Tek sayfalık default template açılış dokümanıyla aynı olduğundan eskiden
     tıklamanın görünür etkisi yoktu ("çalışmıyor" hissi). */
  const deckPages = (f: typeof FORMATS[number]): Design[] => {
    const base = (c1: string, c2: string): Design =>
      ({ fmt: f.id, w: f.w, h: f.h, bgType: "gradient", c1, c2, bgImage: "", layers: [] });
    const L = (text: string, x: number, y: number, pct: number, color: string, weight: number, align: Align, font: number): Layer =>
      ({ id: uid(), text, x, y, size: Math.round(f.w * pct), color, weight, align, font: FONTS[font] ?? FONTS[0] });
    return [
      { ...base("#1e293b", "#0f172a"), layers: [
        L("SUNUM BAŞLIĞI", 0.5, 0.42, 0.07, "#ffffff", 800, "center", 5),
        L("Alt başlık · konuşmacı adı", 0.5, 0.56, 0.028, "#94a3b8", 400, "center", 5),
      ] },
      { ...base("#0f172a", "#334155"), layers: [
        L("Ajanda", 0.08, 0.2, 0.06, "#f1f5f9", 800, "left", 5),
        L("1 · Giriş", 0.1, 0.42, 0.034, "#cbd5e1", 600, "left", 5),
        L("2 · Ana konu", 0.1, 0.54, 0.034, "#cbd5e1", 600, "left", 5),
        L("3 · Sonuç", 0.1, 0.66, 0.034, "#cbd5e1", 600, "left", 5),
      ] },
      { ...base("#0f172a", "#334155"), layers: [
        L("01", 0.08, 0.3, 0.12, "#38bdf8", 800, "left", 5),
        L("Bölüm Başlığı", 0.08, 0.5, 0.06, "#f1f5f9", 800, "left", 5),
        L("kısa açıklama satırı — çift tıkla düzenle", 0.08, 0.62, 0.026, "#94a3b8", 400, "left", 5),
      ] },
      { ...base("#1e293b", "#0f172a"), layers: [
        L("Teşekkürler", 0.5, 0.44, 0.085, "#ffffff", 800, "center", 5),
        L("sorular & iletişim", 0.5, 0.6, 0.028, "#94a3b8", 400, "center", 5),
      ] },
    ];
  };

  const startProject = (t: typeof START_TABS[number]) => {
    if (t.id === "sablon") { setView("templates"); return; }
    const f = FORMATS.find((x) => x.id === t.fmt) ?? FORMATS[0];
    if (t.id === "sunum") {
      resetDoc(deckPages(f));
      addToast("4 slaytlık sunum iskeleti hazır — alttaki şeritten sayfalar arasında geç.", "success");
    } else {
      resetDoc([template(f, t.id)]);
    }
    clearSel(); setSpacing(1); setScale(1); setHue(0);
  };

  const applyTemplate = (t: Template) => {
    commit();
    const f = FORMATS.find((x) => x.id === t.fmt) ?? FORMATS[0];
    setD({
      fmt: f.id, w: f.w, h: f.h, bgType: t.bgType, c1: t.c1, c2: t.c2, bgImage: "",
      layers: t.layers.map((l) => ({ id: uid(), text: l.text, x: l.x, y: l.y, size: Math.round(f.w * l.sizePct), color: l.color, weight: l.weight, align: l.align, font: FONTS[l.font] ?? FONTS[0] })),
    });
    clearSel(); setSpacing(1); setScale(1); setHue(0); setView("design");
  };

  const genBg = () => {
    const p = genPrompt.trim();
    if (!p) return;
    commit();
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
      // (b) Tasarım için en güçlü yapılandırılmış modeli tercih et → daha iyi estetik.
      const active = useStore.getState().strongestModel() ?? useStore.getState().activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const selCtx = sel >= 0 && d.layers[sel]
        ? `\nŞu an SEÇİLİ katman (kullanıcı "bu/şu/seçili" derse bunu kastediyor; layers[${sel}]): ${JSON.stringify(toPartial(d).layers[sel])}`
        : "";
      const sys = `${DESIGN_SYSTEM}\n\nMevcut tuval: ${d.w}x${d.h} (${d.fmt}). Mevcut tasarım (değişiklik isteniyorsa bunu TEMEL al): ${JSON.stringify(toPartial(d))}${selCtx}`;
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
      const full = await readSse(res, (f) => {
        const shown = stripJson(f);
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: shown }; return c; });
      });
      const partial = extractJson(full);
      if (partial) { commit(); applyPartial(partial); }
      const shown = stripJson(full) || (partial ? "Tasarımı güncelledim." : "Yanıt alındı.");
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: shown }; return c; });
      if (!partial) addToast("AI tasarım üretemedi — isteğini biraz daha açık yaz.", "error");
      void imgs;
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${e instanceof Error ? e.message : "bilinmeyen"}` }; return c; });
    } finally { setBusy(false); }
  };

  /* (a) Kod tasarımı — sohbetle HTML/React üret, preview.ts ile canlı render. */
  const sendCode = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs([...next, { role: "assistant", text: "" }]);
    setInput(""); setBusy(true);
    try {
      const cfg = useStore.getState().config;
      const active = useStore.getState().strongestModel() ?? useStore.getState().activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const sys = "Sen uzman bir front-end tasarımcı+geliştiricisin. Kullanıcının isteğine göre TEK, kendi kendine yeten, modern, estetik ve responsive bir tasarım üret. Çıktı: tek bir ```html bloğu (inline CSS; gerekirse vanilla JS). Erişilebilirlik ve dengeli boşluklar önemli. SADECE kod bloğunu ver, açıklama yazma. (React istenirse ```jsx ve bir App bileşeni kullan.)"
        + (codeArt ? `\n\nMevcut kod (değişiklik isteniyorsa bunu TEMEL al):\n${codeArt.content.slice(0, 8000)}` : "");
      const apiMsgs = next.slice(-6).map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMsgs, baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
          systemPrompt: sys, fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
          tools: false, webSearch: false, temperature: 0.6,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
      const full = await readSse(res, (f) => {
        const shown = stripJson(f) || "Kod üretiliyor…";
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: shown }; return c; });
      });
      const blocks = parseBlocks(full);
      const block = blocks.find((b) => ["html", "htm", "jsx", "tsx", "react", "js", "javascript", "svg"].includes(b.lang)) || blocks[0];
      let ok = false;
      if (block) {
        const art = buildSingleBlockPreview(block.lang || "html", block.code);
        if (art) { setCodeArt({ type: art.type, content: art.content }); setCodeView("preview"); setCodeReload((k) => k + 1); ok = true; }
      } else if (/<[a-z]/i.test(full)) {
        const art = buildSingleBlockPreview("html", full);
        if (art) { setCodeArt({ type: art.type, content: art.content }); setCodeReload((k) => k + 1); ok = true; }
      }
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: stripJson(full) || (ok ? "Tasarımı kodladım." : "Yanıt alındı.") }; return c; });
      if (!ok) addToast("Kod üretilemedi — isteğini biraz daha açık yaz.", "error");
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: `Hata: ${e instanceof Error ? e.message : "bilinmeyen"}` }; return c; });
    } finally { setBusy(false); }
  };

  /* Aktif moda göre gönder (Tuval = tasarım JSON; Kod = HTML/React). */
  const onSend = () => { if (dmode === "code") void sendCode(); else void send(); };

  /* ---- Seçili elemanı AI ile düzenle (yüzen araç çubuğu) — Claude Design imzası.
     Yalnız seçili katman JSON'u gönderilir; AI değişen alanları döndürür. ---- */
  const aiEditLayer = async () => {
    const instruction = aiSelText.trim();
    const ly = d.layers[sel];
    if (!instruction || !ly || aiSelBusy) return;
    setAiSelBusy(true);
    try {
      const cfg = useStore.getState().config;
      const active = useStore.getState().strongestModel() ?? useStore.getState().activeModel();
      if (!active) throw new Error("Önce Ayarlar → Modeller'den bir model seç.");
      const apiKey = await usableApiKey(active);
      const lyJson = { text: ly.text, x: +ly.x.toFixed(2), y: +ly.y.toFixed(2), sizePct: +(ly.size / d.w).toFixed(3), color: ly.color, weight: ly.weight, align: ly.align, font: Math.max(0, FONTS.indexOf(ly.font)) };
      const sys = `Bir tasarım metin katmanını düzenliyorsun. Mevcut katman: ${JSON.stringify(lyJson)}\nKullanıcının isteğine göre SADECE değişen alanları içeren tek bir \`\`\`json bloğu döndür. Alanlar: text, x (0-1), y (0-1), sizePct (yazıboyu/genişlik, ör. 0.04), color (#hex), weight (100-900), align (left|center|right), font (0-5). Açıklama yazma.`;
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: instruction }],
          baseUrl: active.baseUrl, model: active.model, apiKey, provider: active.provider,
          systemPrompt: sys, fallbacks: buildFallbackChain(cfg.models, cfg.activeModelId),
          tools: false, webSearch: false, temperature: 0.4,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM ${res.status}`);
      const full = await readSse(res);
      const p = extractJson(full);
      if (!p) throw new Error("AI yanıtı çözümlenemedi — tekrar dene");
      commit();
      const patch: Partial<Layer> = {};
      if (typeof p.text === "string") patch.text = p.text;
      if (p.x !== undefined) patch.x = clamp01(Number(p.x));
      if (p.y !== undefined) patch.y = clamp01(Number(p.y));
      if (p.sizePct !== undefined && Number(p.sizePct) > 0) patch.size = Math.max(10, Math.round(d.w * Number(p.sizePct)));
      if (typeof p.color === "string") patch.color = p.color;
      if (p.weight !== undefined && Number(p.weight)) patch.weight = Number(p.weight);
      if (["left", "center", "right"].includes(String(p.align))) patch.align = p.align as Align;
      if (p.font !== undefined && FONTS[Number(p.font)]) patch.font = FONTS[Number(p.font)];
      upLayer(patch);
      setAiSelText(""); setAiSelOpen(false);
      addToast("Katman güncellendi ✓", "success");
    } catch (e) {
      addToast(`AI düzenleme: ${e instanceof Error ? e.message : "bilinmeyen hata"}`, "error");
    } finally { setAiSelBusy(false); }
  };

  const downloadCode = () => {
    if (!codeArt) return;
    const blob = new Blob([codeArt.content], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(title || "tasarim").replace(/\s+/g, "-")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
    setExporting(true);
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
      /* (c1) Görsel/logo katmanları — arka plan üstüne, metnin altına. */
      for (const im of vd.images ?? []) {
        try {
          const img = await loadImg(im.src);
          const w = vd.w * im.w; const h = w * (img.height / Math.max(1, img.width));
          ctx.drawImage(img, vd.w * im.x - w / 2, vd.h * im.y - h / 2, w, h);
        } catch { /* görsel atla */ }
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

  const imagesHtml = (x: Design) => (x.images ?? []).map((im) =>
    `<img src="${im.src}" alt="" style="position:absolute;left:${im.x * 100}%;top:${im.y * 100}%;width:${im.w * 100}%;transform:translate(-50%,-50%)" />`,
  ).join("");

  const bgCss = (x: Design) => x.bgType === "image" && x.bgImage
    ? `background:url('${x.bgImage}') center/cover;`
    : x.bgType === "color" ? `background:${x.c1};` : `background:linear-gradient(135deg,${x.c1},${x.c2});`;

  /* Tek sayfa stage HTML'i — slider'lar uygulanmış, inline arka plan + en/boy. */
  const pageStage = (p: Design, extra: string) => {
    const x = applyView(p, spacing, scale, hue);
    return `<div class="stage" style="aspect-ratio:${x.w}/${x.h};${bgCss(x)}${extra}">${imagesHtml(x)}${layersHtml(x)}</div>`;
  };

  const exportHtml = () => {
    const stages = pages.map((p) => pageStage(p, "")).join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || "Tasarım")}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0d;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;min-height:100vh}.stage{container-type:inline-size;width:min(96vw,960px);position:relative;overflow:hidden;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.5)}</style></head><body>${stages}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(title || "tasarim").replace(/\s+/g, "-")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const exportPdf = () => {
    const w = window.open("", "_blank");
    if (!w) { addToast("Açılır pencere engellendi — PDF için açılır pencereye izin ver.", "error"); return; }
    const first = pages[0];
    const stages = pages.map((p, i) => pageStage(p, `width:100vw;${i < pages.length - 1 ? "page-break-after:always;" : ""}`)).join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title || "Tasarım")}</title><style>@page{size:${first.w > first.h ? "landscape" : "portrait"};margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}body{display:block}.stage{container-type:inline-size;position:relative;overflow:hidden}</style></head><body>${stages}<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  };

  /* ---- Galeri ---- */
  const save = () => {
    const t = title.trim() || `Tasarım ${saved.length + 1}`;
    /* Çok-sayfalı belge: tüm sayfaları sakla (eski tekil format ile geri uyumlu). */
    const design: SavedDesign = { id: `${Date.now()}`, title: t, code: JSON.stringify({ pages }), createdAt: Date.now() };
    saveConfig({ ...config, savedDesigns: [design, ...saved].slice(0, 100) });
    addToast(`Tasarım kaydedildi${pages.length > 1 ? ` (${pages.length} sayfa)` : ""}`, "success");
  };
  const load = (sd: SavedDesign) => {
    try {
      const parsed = JSON.parse(sd.code) as Design | { pages: Design[] };
      const ps = "pages" in parsed && Array.isArray(parsed.pages) ? parsed.pages : [parsed as Design];
      resetDoc(ps); setTitle(sd.title); clearSel(); setSpacing(1); setScale(1); setHue(0); setView("design");
    } catch { /* eski format */ }
  };
  const del = (id: string) => saveConfig({ ...config, savedDesigns: saved.filter((x) => x.id !== id) });

  const L = sel >= 0 ? d.layers[sel] : undefined;
  const bgStyle: React.CSSProperties =
    vd.bgType === "image" && vd.bgImage ? { backgroundImage: `url(${vd.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : vd.bgType === "color" ? { background: vd.c1 }
        : { background: `linear-gradient(135deg, ${vd.c1}, ${vd.c2})` };
  const thumbBg = (p: Design): React.CSSProperties =>
    p.bgType === "image" && p.bgImage ? { backgroundImage: `url(${p.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : p.bgType === "color" ? { background: p.c1 }
        : { background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-modal-bg pb-[var(--surface-pb,0px)] sm:pb-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Üst araç çubuğu */}
      <div className="brand-rule glass shrink-0 flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5">
        <span className="w-8 h-8 rounded-xl bg-brand/12 border border-brand/20 grid place-items-center text-brand shrink-0"><Sparkles size={16} /></span>
        <StudioSwitcher active="canvas" />
        {/* (a) Alt mod — Tuval (katman) | Kod (HTML/React). Mobilde ⋯ menüde. */}
        <div className="hidden sm:flex items-center bg-bgsoft border border-line rounded-lg p-0.5 text-xs font-semibold shrink-0">
          <button onClick={() => setDmode("canvas")} className={`px-2 py-1 rounded-md transition-colors ${dmode === "canvas" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>Tuval</button>
          <button onClick={() => setDmode("code")} className={`px-2 py-1 rounded-md transition-colors ${dmode === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>Kod</button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tasarım adı…" className="hidden md:block ml-2 w-40 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/50" />
        {dmode === "canvas" && (
          <div className="hidden sm:flex items-center gap-0.5 ml-1 shrink-0">
            <button onClick={doUndo} disabled={!hist.past.length} title="Geri al (Ctrl+Z)" className="w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-ink disabled:opacity-30 transition-colors"><Undo2 size={14} /></button>
            <button onClick={doRedo} disabled={!hist.future.length} title="Yinele (Ctrl+Y)" className="w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-ink disabled:opacity-30 transition-colors"><Redo2 size={14} /></button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {/* Dışa aktar */}
          <ExportMenu
            triggerLabel="İndir"
            busy={exporting}
            disabled={exporting}
            options={[
              { key: "png", label: "PNG görsel", icon: <FileImage size={14} className="text-brand" />, onSelect: exportPng },
              { key: "html", label: "Bağımsız HTML", icon: <FileCode size={14} className="text-brand" />, onSelect: exportHtml },
              { key: "pdf", label: "PDF (yazdır)", icon: <FileText size={14} className="text-brand" />, onSelect: exportPdf },
            ]}
          />

          <button onClick={save} className="btn-brand-glow flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[#111110] text-xs font-bold"><Save size={13} /> <span className="hidden sm:inline">Kaydet</span></button>

          {/* ⋯ ikincil eylemler (sade üst bar) */}
          <div className="relative">
            <button onClick={() => setStudioMenu((v) => !v)} title="Daha fazla" className={`w-8 h-8 grid place-items-center rounded-lg border transition-colors ${studioMenu || view !== "design" ? "border-brand/50 text-brand" : "border-line text-muted hover:text-ink"}`}><MoreHorizontal size={16} /></button>
            {studioMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStudioMenu(false)} />
                <div className="absolute right-0 mt-1.5 z-20 w-52 bg-surface border border-line rounded-xl shadow-2xl p-1 text-sm">
                  {/* Mobilde üst bardan kaldırılanlar (⋯'den erişilir) */}
                  <div className="sm:hidden">
                    <button onClick={() => { setDmode((m) => (m === "code" ? "canvas" : "code")); setStudioMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><FileCode size={14} className={dmode === "code" ? "text-brand" : "text-muted/60"} /> Kod modu</button>
                    {dmode === "canvas" && (
                      <div className="flex gap-1 px-2 pb-1">
                        <button onClick={doUndo} disabled={!hist.past.length} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-line text-xs text-muted hover:text-ink disabled:opacity-30"><Undo2 size={13} /> Geri al</button>
                        <button onClick={doRedo} disabled={!hist.future.length} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-line text-xs text-muted hover:text-ink disabled:opacity-30"><Redo2 size={13} /> Yinele</button>
                      </div>
                    )}
                    <div className="h-px bg-line/60 my-1" />
                  </div>
                  <button onClick={() => { setView((v) => (v === "templates" ? "design" : "templates")); setStudioMenu(false); }} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left ${view === "templates" ? "text-brand" : ""}`}><LayoutTemplate size={14} className="text-brand" /> Hazır şablonlar</button>
                  <button onClick={() => { setView((v) => (v === "gallery" ? "design" : "gallery")); setStudioMenu(false); }} className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left ${view === "gallery" ? "text-brand" : ""}`}><span className="flex items-center gap-2"><LayoutGrid size={14} className="text-brand" /> Kayıtlı tasarımlar</span><span className="text-[10px] font-mono text-muted/60">{saved.length}</span></button>
                  <div className="h-px bg-line/60 my-1" />
                  <button onClick={() => setChatOpen((v) => !v)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><MessageSquare size={14} className={chatOpen ? "text-brand" : "text-muted/60"} /> Sohbet paneli</button>
                  <button onClick={() => setTweaksOpen((v) => !v)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bgsoft transition-colors text-left"><Sliders size={14} className={tweaksOpen ? "text-brand" : "text-muted/60"} /> Tweaks paneli</button>
                  <div className="h-px bg-line/60 my-1" />
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="text-xs text-muted/70">Kalite</span>
                    <select value={quality} onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY)} className="bg-bgsoft border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-brand/50 cursor-pointer">
                      {Object.entries(QUALITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={() => nav.close()} className="w-8 h-8 grid place-items-center rounded-lg text-muted/60 hover:text-ink hover:bg-bgsoft transition-colors"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {view === "templates" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-3">
              <div className="text-sm font-bold">Hazır şablonlar</div>
              <div className="text-[11px] text-muted/60">Bir şablona dokun, hemen düzenlemeye başla. Sonra sohbetten “{`başlığı X yap`}” gibi komutlarla ücretsiz değiştir.</div>
            </div>
            {/* Kategori filtresi */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(["Hepsi", "Sunum", "Afiş", "Sosyal"] as const).map((c) => (
                <button key={c} onClick={() => setTplCat(c)} className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors ${tplCat === c ? "border-brand/50 bg-brand/12 text-brand" : "border-line/60 text-muted hover:text-ink hover:border-brand/30"}`}>
                  {c}{c !== "Hepsi" ? ` (${TEMPLATES.filter((t) => t.cat === c).length})` : ` (${TEMPLATES.length})`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {TEMPLATES.filter((t) => tplCat === "Hepsi" || t.cat === tplCat).map((t) => {
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
                  let dd: Design | null = null;
                  try { const pr = JSON.parse(sd.code) as Design | { pages: Design[] }; dd = "pages" in pr && Array.isArray(pr.pages) ? pr.pages[0] : (pr as Design); } catch { /* yok */ }
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
                      <div className="text-xs text-muted/60 leading-relaxed">Ne tasarlamak istediğini yaz — istersen görsel de ekle.</div>
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
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                      placeholder={dmode === "code" ? "Kod tasarımı iste (ör. fiyatlandırma sayfası)…" : "Tasarım iste veya değişiklik söyle…"}
                      className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24 py-1"
                    />
                    <button onClick={onSend} disabled={busy} className="shrink-0 w-7 h-7 grid place-items-center rounded-lg bg-brand text-[#111110] disabled:opacity-50 transition-opacity">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ORTA — Kod modu (HTML/React canlı render) */}
            {dmode === "code" ? (
              <div className="flex-1 min-h-0 flex flex-col bg-[#0a0a0d]">
                <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-line/60">
                  <div className="flex items-center bg-bgsoft border border-line/60 rounded-lg p-0.5 text-[11px] font-semibold">
                    <button onClick={() => setCodeView("preview")} className={`px-2 py-1 rounded-md transition-colors ${codeView === "preview" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>Önizleme</button>
                    <button onClick={() => setCodeView("code")} className={`px-2 py-1 rounded-md transition-colors ${codeView === "code" ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"}`}>Kod</button>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setCodeReload((k) => k + 1)} disabled={!codeArt} title="Yenile" className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft disabled:opacity-30 transition-colors"><RotateCw size={14} /></button>
                    <button onClick={() => { if (codeArt) { const u = URL.createObjectURL(new Blob([codeArt.content], { type: "text/html" })); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 10000); } }} disabled={!codeArt} title="Yeni sekmede aç" className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft disabled:opacity-30 transition-colors"><ExternalLink size={14} /></button>
                    <button onClick={downloadCode} disabled={!codeArt} title="HTML indir" className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgsoft disabled:opacity-30 transition-colors"><Download size={14} /></button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 bg-white">
                  {!codeArt ? (
                    <div className="h-full grid place-items-center text-center text-sm text-muted/50 bg-[#0a0a0d] px-6">
                      Soldan kod tasarımı iste — ör. “API ürünü için hero + fiyatlandırma sayfası”. HTML/React üretir, burada canlı görünür.
                    </div>
                  ) : codeView === "preview" ? (
                    <iframe key={codeReload} srcDoc={codeArt.content} sandbox="allow-scripts allow-modals" referrerPolicy="no-referrer" className="w-full h-full border-0" title="Kod önizleme" />
                  ) : (
                    <pre className="w-full h-full overflow-auto m-0 p-4 text-[12px] font-mono bg-[#0b0b0d] text-[#d6d6d6]"><code>{codeArt.content}</code></pre>
                  )}
                </div>
              </div>
            ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-[#0a0a0d]">
              <div ref={stageWrapRef} className="flex-1 min-h-0 grid place-items-center p-4 sm:p-8 overflow-auto">
              <div
                ref={previewRef}
                onPointerDown={(e) => { if (e.target === e.currentTarget) clearSel(); }}
                onDoubleClick={(e) => {
                  /* Boş tuvale çift tık → o noktaya yeni metin. */
                  if (e.target !== e.currentTarget) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  addLayer(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height));
                }}
                className="relative shadow-2xl rounded-sm overflow-hidden"
                style={{ ...bgStyle, containerType: "inline-size", width: zoom === 0 ? "min(100%, 640px)" : `${Math.round(640 * zoom)}px`, aspectRatio: `${vd.w} / ${vd.h}` }}
              >
                {(vd.images ?? []).map((im) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={im.id} src={im.src} alt="" draggable={false}
                    onPointerDown={(e) => startDrag(e, { kind: "img", id: im.id })}
                    onPointerMove={onDragMove} onPointerUp={endDrag}
                    className={`absolute touch-none select-none cursor-grab active:cursor-grabbing ${selImg === im.id ? "outline outline-2 outline-brand" : "hover:outline hover:outline-1 hover:outline-brand/40"}`}
                    style={{ left: `${im.x * 100}%`, top: `${im.y * 100}%`, width: `${im.w * 100}%`, transform: "translate(-50%,-50%)" }}
                  />
                ))}
                {vd.layers.map((ly, i) => {
                  const baseLy = d.layers[i];
                  const isSel = i === sel, isEdit = i === editing;
                  return (
                    <div
                      key={ly.id}
                      onPointerDown={(e) => { if (!isEdit) startDrag(e, { kind: "text", i }); }}
                      onPointerMove={onDragMove} onPointerUp={endDrag}
                      onDoubleClick={(e) => { e.stopPropagation(); if (!isEdit) startEdit(i); }}
                      className={`absolute px-2 touch-none ${isEdit ? "" : "cursor-grab active:cursor-grabbing select-none"} ${isSel && !isEdit ? "outline outline-1 outline-brand" : !isEdit ? "hover:outline hover:outline-1 hover:outline-brand/30" : ""}`}
                      style={{
                        left: ly.align === "left" ? `${ly.x * 100}%` : ly.align === "right" ? undefined : "50%",
                        right: ly.align === "right" ? `${(1 - ly.x) * 100}%` : undefined,
                        top: `${ly.y * 100}%`,
                        transform: ly.align === "center" ? "translate(-50%,-50%)" : "translateY(-50%)",
                        color: ly.color,
                        fontSize: `${(ly.size / vd.w * 100).toFixed(3)}cqw`,
                        fontWeight: ly.weight, fontFamily: ly.font, textAlign: ly.align,
                        width: ly.align === "center" || isEdit ? "88%" : "auto", maxWidth: "88%", lineHeight: 1.18,
                      }}
                    >
                      {isEdit && baseLy ? (
                        <textarea
                          autoFocus
                          value={baseLy.text}
                          onChange={(e) => upLayerAt(i, { text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                            if (e.key === "Escape") { editCancelRef.current = true; (e.target as HTMLTextAreaElement).blur(); }
                          }}
                          onBlur={() => endEdit(!editCancelRef.current)}
                          onPointerDown={(e) => e.stopPropagation()}
                          rows={Math.max(1, baseLy.text.split("\n").length)}
                          className="w-full bg-transparent outline-dashed outline-1 outline-brand/70 resize-none overflow-hidden p-0 border-0"
                          style={{ fontSize: "inherit", fontWeight: "inherit", fontFamily: "inherit", color: "inherit", textAlign: ly.align, lineHeight: "inherit" }}
                        />
                      ) : ly.text}
                      {isSel && !isEdit && (
                        <span
                          onPointerDown={(e) => startDrag(e, { kind: "tsize", i })}
                          onPointerMove={onDragMove} onPointerUp={endDrag}
                          title="Boyutlandır"
                          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-brand border border-white/70 cursor-nwse-resize touch-none"
                        />
                      )}
                    </div>
                  );
                })}
                {/* Seçili görselin boyutlandırma tutamacı (sağ kenar ortası) */}
                {selImg && (() => {
                  const im = (vd.images ?? []).find((x) => x.id === selImg);
                  if (!im) return null;
                  return (
                    <span
                      onPointerDown={(e) => startDrag(e, { kind: "isize", id: im.id })}
                      onPointerMove={onDragMove} onPointerUp={endDrag}
                      title="Boyutlandır"
                      className="absolute z-10 w-3 h-3 rounded-sm bg-brand border border-white/70 cursor-ew-resize touch-none"
                      style={{ left: `${(im.x + im.w / 2) * 100}%`, top: `${im.y * 100}%`, transform: "translate(-50%,-50%)" }}
                    />
                  );
                })()}
                {/* Yüzen araç çubuğu — seçili metin katmanı (renk · boyut · hizalama · AI · sil) */}
                {sel >= 0 && d.layers[sel] && editing < 0 && (() => {
                  const ly = vd.layers[sel];
                  const above = ly.y > 0.16;
                  return (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute z-20 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-surface/95 border border-line shadow-xl text-ink"
                      style={{ left: `${clamp01(ly.x) * 100}%`, top: `${ly.y * 100}%`, transform: above ? "translate(-50%, calc(-100% - 14px))" : "translate(-50%, 22px)", fontSize: 12 }}
                    >
                      <input type="color" value={d.layers[sel].color} onFocus={commit} onChange={(e) => upLayer({ color: e.target.value })} title="Renk" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" />
                      <button onClick={() => { commit(); upLayer({ size: Math.max(10, Math.round(d.layers[sel].size * 0.9)) }); }} title="Küçült" className="w-6 h-6 grid place-items-center rounded hover:bg-bgsoft text-[10px] font-bold shrink-0">A−</button>
                      <button onClick={() => { commit(); upLayer({ size: Math.round(d.layers[sel].size * 1.1) }); }} title="Büyüt" className="w-6 h-6 grid place-items-center rounded hover:bg-bgsoft text-[12px] font-bold shrink-0">A+</button>
                      <button onClick={() => { commit(); const order: Align[] = ["left", "center", "right"]; upLayer({ align: order[(order.indexOf(d.layers[sel].align) + 1) % 3] }); }} title="Hizalama" className="w-6 h-6 grid place-items-center rounded hover:bg-bgsoft shrink-0">{d.layers[sel].align === "left" ? "⇤" : d.layers[sel].align === "center" ? "↔" : "⇥"}</button>
                      <button onClick={() => setAiSelOpen((v) => !v)} title="AI ile düzenle" className={`w-6 h-6 grid place-items-center rounded shrink-0 ${aiSelOpen ? "bg-brand/20 text-brand" : "hover:bg-bgsoft text-brand"}`}><Sparkles size={12} /></button>
                      <button onClick={() => { delLayer(sel); setSel(-1); }} title="Sil (Delete)" className="w-6 h-6 grid place-items-center rounded hover:bg-bgsoft text-muted hover:text-red shrink-0"><Trash2 size={12} /></button>
                      {aiSelOpen && (
                        <div className="flex items-center gap-1 pl-1.5 ml-0.5 border-l border-line/60">
                          <input
                            autoFocus value={aiSelText} onChange={(e) => setAiSelText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void aiEditLayer(); if (e.key === "Escape") setAiSelOpen(false); }}
                            placeholder="bunu kırmızı yap…"
                            className="w-36 bg-bgsoft border border-line rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-brand/50"
                          />
                          <button onClick={() => void aiEditLayer()} disabled={aiSelBusy} title="Uygula" className="w-6 h-6 grid place-items-center rounded bg-brand text-[#111110] disabled:opacity-50 shrink-0">
                            {aiSelBusy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              </div>
              {/* Sayfa şeridi (çok-sayfalı belge — Canva tarzı) */}
              <div className="shrink-0 border-t border-line/40 bg-surface/40 px-3 py-2 flex items-center gap-2 overflow-x-auto">
                {pages.map((p, i) => (
                  <button key={i} onClick={() => setPageIndex(i)} title={`Sayfa ${i + 1}`} className={`relative shrink-0 rounded-md overflow-hidden border-2 transition-colors ${i === pageIdx ? "border-brand" : "border-line/40 hover:border-brand/40"}`} style={{ height: 40, aspectRatio: `${p.w}/${p.h}` }}>
                    <span className="block w-full h-full" style={thumbBg(p)} />
                    <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-black/50 text-white px-1 rounded-tl">{i + 1}</span>
                  </button>
                ))}
                <button onClick={addPage} title="Yeni sayfa" className="shrink-0 w-9 h-10 grid place-items-center rounded-md border border-dashed border-line/60 text-muted hover:text-brand hover:border-brand/50 transition-colors"><Plus size={15} /></button>
                <button onClick={dupPage} title="Sayfayı çoğalt" className="shrink-0 px-2 py-1 rounded-lg border border-line text-[11px] font-semibold text-muted hover:text-ink transition-colors">Çoğalt</button>
                {pages.length > 1 && <button onClick={delPage} title="Sayfayı sil" className="shrink-0 px-2 py-1 rounded-lg border border-line text-[11px] font-semibold text-muted hover:text-red transition-colors">Sil</button>}
                {/* Zoom — Sığdır / % (Ctrl+tekerlek de çalışır) */}
                <div className="ml-auto shrink-0 flex items-center gap-0.5">
                  <button onClick={() => setZoom((z) => Math.max(0.5, +((z || 1) - 0.25).toFixed(2)))} title="Uzaklaş" className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"><ZoomOut size={13} /></button>
                  <button onClick={() => setZoom(0)} title="Sığdır" className={`px-1.5 h-7 rounded-lg text-[11px] font-semibold transition-colors ${zoom === 0 ? "text-brand" : "text-muted hover:text-ink hover:bg-bgsoft"}`}>{zoom === 0 ? "Sığdır" : `${Math.round(zoom * 100)}%`}</button>
                  <button onClick={() => setZoom((z) => Math.min(3, +((z || 1) + 0.25).toFixed(2)))} title="Yakınlaş" className="w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-bgsoft transition-colors"><ZoomIn size={13} /></button>
                </div>
              </div>
            </div>
            )}

            {/* SAĞ — Tweaks paneli. Mobilde alt-sayfa (bottom sheet) olarak açılır;
                masaüstünde sağ sütun. ⋯ menüdeki "Tweaks paneli" iki düzende de çalışır. */}
            {tweaksOpen && (
              <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] rounded-t-2xl border-t border-line bg-surface shadow-2xl overflow-y-auto p-4 space-y-4 pb-[calc(var(--surface-pb,0px)+1rem)] sm:static sm:z-auto sm:max-h-none sm:rounded-none sm:shadow-none sm:w-72 sm:shrink-0 sm:border-t-0 sm:border-l sm:border-line/60 sm:bg-surface/30 sm:pb-4">
                <button onClick={() => setTweaksOpen(false)} className="sm:hidden w-full flex items-center justify-center gap-1.5 text-xs text-muted py-1 -mt-1">
                  <span className="w-8 h-1 rounded-full bg-line" /> Kapat
                </button>
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
                      <button key={p.name} onClick={() => { commit(); setD((prev) => ({ ...prev, bgType: "gradient", c1: p.c1, c2: p.c2 })); }} title={p.name} className="h-8 rounded-lg border border-line/60 hover:border-brand transition-colors" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="color" value={d.c1} onFocus={commit} onChange={(e) => setD((p) => ({ ...p, c1: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 1" />
                    <input type="color" value={d.c2} onFocus={commit} onChange={(e) => setD((p) => ({ ...p, c2: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent" title="Renk 2" />
                    <button onClick={() => { commit(); setD((p) => ({ ...p, bgType: p.bgType === "color" ? "gradient" : "color" })); }} className="text-[11px] px-2 py-1 rounded border border-line text-muted hover:text-ink">{d.bgType === "color" ? "Düz" : "Gradyan"}</button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><ImageIcon size={11} /> AI arka plan (ücretsiz)</div>
                  <textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} rows={2} placeholder="ör: minimal soyut amber dalgalar" className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand/50 resize-none" />
                  <button onClick={genBg} className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors"><Wand2 size={13} className="text-brand" /> Arka plan üret</button>
                </div>

                {/* (c1) Görsel / Logo katmanları */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center gap-1"><ImageIcon size={11} /> Görsel / Logo</div>
                  <input ref={imgLayerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImageLayer(f); e.target.value = ""; }} />
                  <button onClick={() => imgLayerRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line hover:border-brand/50 text-xs font-semibold transition-colors"><Upload size={13} className="text-brand" /> Görsel/logo ekle</button>
                  {(d.images ?? []).map((im) => (
                    <div key={im.id} className="mt-2 border-t border-line/40 pt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelImg(im.id); setSel(-1); }} title="Tuvalde seç" className={`block w-8 h-8 rounded border bg-cover bg-center bg-no-repeat shrink-0 ${selImg === im.id ? "border-brand" : "border-line"}`} style={{ backgroundImage: `url(${im.src})` }} />
                        <label className="flex-1 text-[11px] text-muted/70">Boyut
                          <input type="range" min={0.05} max={1} step={0.01} value={im.w} onPointerDown={commit} onChange={(e) => updImage(im.id, { w: +e.target.value })} className="w-full accent-brand" />
                        </label>
                        <button onClick={() => { delImage(im.id); if (selImg === im.id) setSelImg(null); }} className="text-muted/50 hover:text-red shrink-0" title="Sil"><Trash2 size={13} /></button>
                      </div>
                      <div className="text-[10px] text-muted/50 mt-1">Konum için tuvalde sürükle.</div>
                    </div>
                  ))}
                </div>

                {/* Katmanlar / doğrudan düzenleme */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted/45 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Type size={11} /> Metin katmanları</span>
                    <button onClick={() => addLayer()} className="text-brand hover:text-branddim"><Plus size={13} /></button>
                  </div>
                  <div className="space-y-1 mb-2">
                    {d.layers.map((ly, i) => (
                      <div key={ly.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer text-xs ${i === sel ? "bg-brand/10 text-brand" : "text-muted hover:bg-bgsoft/60"}`} onClick={() => { setSel(i); setSelImg(null); }}>
                        <span className="flex-1 truncate">{ly.text || "(boş)"}</span>
                        {d.layers.length > 1 && <button onClick={(e) => { e.stopPropagation(); delLayer(i); setSel(-1); }} className="text-muted/50 hover:text-red"><Trash2 size={11} /></button>}
                      </div>
                    ))}
                    {d.layers.length === 0 && <div className="text-[11px] text-muted/50 px-2 py-1">Katman yok — sohbetten üret, + ile ya da tuvale çift tıkla ekle.</div>}
                  </div>
                  {L && (
                    <div className="space-y-2 border-t border-line/40 pt-2">
                      <textarea value={L.text} onFocus={commit} onChange={(e) => upLayer({ text: e.target.value })} rows={2} className="w-full bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand/50 resize-none" />
                      <div className="flex items-center gap-2">
                        <input type="color" value={L.color} onFocus={commit} onChange={(e) => upLayer({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                        <input type="range" min={16} max={Math.round(d.w * 0.14)} value={L.size} onPointerDown={commit} onChange={(e) => upLayer({ size: +e.target.value })} className="flex-1 accent-brand" />
                      </div>
                      <select value={L.font} onChange={(e) => { commit(); upLayer({ font: e.target.value }); }} className="w-full bg-bgsoft border border-line rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer">
                        {FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</option>)}
                      </select>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as Align[]).map((a) => (
                          <button key={a} onClick={() => { commit(); upLayer({ align: a }); }} className={`flex-1 py-1 rounded text-[11px] border ${L.align === a ? "border-brand text-brand" : "border-line text-muted"}`}>{a === "left" ? "Sol" : a === "center" ? "Orta" : "Sağ"}</button>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted/50">Konum: tuvalde sürükle · ok tuşlarıyla taşı · köşe tutamacıyla boyutlandır · çift-tık ile yaz.</div>
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
