"use client";

/* Stüdyo composer'ının Claude Design'daki karşılığına eksik kalan seçenekleri:
   tasarım sistemi seçici, çoklu model seçici, şablon/beceri arama (+ görsel
   önizleme şeridi). Hem StudioHomeScreen (ilk mesaj) hem de ChatPanel (takip
   mesajları) bu AYNI bileşenleri paylaşır — iki yerde de aynı davranış/görünüm.
   Mobil+masaüstü: her popover açılırken tetikleyici düğmenin ekrandaki
   konumuna göre sağa/sola hizalanır (bkz. usePopover'daki align hesabı) —
   dar ekranlarda popover viewport dışına taşmaz. */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cpu, LayoutTemplate, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { bundledDesignSystems } from "@/lib/designSystems";
import { STUDIO_TEMPLATES, type StudioTemplate } from "@/lib/studioTemplates";

/** Dışarı tıklama/Escape ile kapanan açılır panel — AuthButton.tsx'teki ile
    aynı hafif desen + mobil/masaüstü taşma koruması için hizalama hesabı. */
function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("left");
  const ref = useRef<T>(null);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && ref.current) {
        /* Tetikleyicinin sağında popover genişliği (~300px) kadar yer yoksa
           (dar mobil ekran, ya da düğme sıranın sağına düşmüşse) panel SAĞA
           değil SOLA doğru açılır. */
        const rect = ref.current.getBoundingClientRect();
        setAlign(window.innerWidth - rect.left < 300 ? "right" : "left");
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, toggle, close: () => setOpen(false), ref, align };
}

/** Popover paneli için ortak konumlandırma sınıfları — align'a göre sağ/sol,
    her koşulda viewport genişliğini aşmaz. */
function panelPos(align: "left" | "right") {
  return `absolute bottom-full mb-1.5 z-30 max-w-[calc(100vw-2rem)] ${align === "right" ? "right-0" : "left-0"}`;
}

export function DesignSystemPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { open, toggle, close, ref, align } = usePopover<HTMLDivElement>();
  const current = bundledDesignSystems.find((s) => s.id === value) ?? bundledDesignSystems[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Tasarım sistemi"
        className="shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        <Palette size={13} />
        <span className="max-w-[110px] truncate">{current.name}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className={`${panelPos(align)} w-56 max-h-72 overflow-auto rounded-xl border border-line bg-surface elev-2 py-1.5`}>
          {bundledDesignSystems.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); close(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bgsoft/70 transition-colors ${s.id === value ? "bg-brand/8" : ""}`}
            >
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: s.accent }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{s.name}</span>
                <span className="block text-[10px] text-muted/60">{s.category}</span>
              </span>
              {s.id === value && <span className="text-brand text-xs shrink-0">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModelPicker({
  fusionEnabled, onFusionChange,
}: {
  fusionEnabled: boolean;
  onFusionChange: (v: boolean) => void;
}) {
  const { open, toggle, close, ref, align } = usePopover<HTMLDivElement>();
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const models = config.models;
  const qualityModelIds = config.qualityModelIds ?? [];
  const activeModel = models.find((m) => m.id === config.activeModelId);

  const label = fusionEnabled
    ? `Fusion · ${qualityModelIds.length || "auto"}`
    : (activeModel?.label ?? "Model");

  /* Bir modeli işaretlemek/kaldırmak — Ayarlar → Kalite'deki (qualityModelIds)
     AYNI alanı kullanır, yani buradan seçilen modeller Fusion'da da geçerli
     olur. 2+ işaretli model otomatik olarak Fusion'ı açar (madde: "çoklu
     model seçimi"), tek model işaretini kaldırmak Fusion'ı kapatır. */
  const toggleModel = (id: string) => {
    const selected = qualityModelIds.includes(id);
    if (selected) {
      const next = qualityModelIds.filter((x) => x !== id);
      saveConfig({ ...config, qualityModelIds: next });
      if (next.length < 2) onFusionChange(false);
    } else {
      if (qualityModelIds.length >= 3) return;
      const next = [...qualityModelIds, id];
      saveConfig({ ...config, qualityModelIds: next });
      if (next.length >= 2) onFusionChange(true);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Model seçimi — birden fazla işaretlersen Fusion (taslak + hakem) devreye girer"
        className={`shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-medium transition-colors ${
          fusionEnabled
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-line/70 bg-bgsoft/60 text-muted hover:text-ink hover:border-brand/40"
        }`}
      >
        <Cpu size={13} />
        <span className="max-w-[130px] truncate">{label}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className={`${panelPos(align)} w-64 max-h-80 overflow-auto rounded-xl border border-line bg-surface elev-2 py-1.5`}>
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/50">
            {qualityModelIds.length}/3 seçili · 2+ seçim Fusion&apos;ı açar
          </p>
          {models.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted/60">Ayarlar → Modeller&apos;den model ekle.</p>
          ) : (
            models.map((m) => {
              const checked = qualityModelIds.includes(m.id);
              const isActive = m.id === config.activeModelId;
              return (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-bgsoft/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModel(m.id)}
                    className="accent-brand shrink-0 cursor-pointer"
                  />
                  <button onClick={() => toggleModel(m.id)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium truncate">{m.label}</span>
                    <span className="block text-[10px] text-muted/60">{m.provider}</span>
                  </button>
                  {!checked && (
                    <button
                      onClick={() => { setActiveModel(m.id); onFusionChange(false); close(); }}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${isActive ? "text-brand" : "text-muted/50 hover:text-brand"}`}
                    >
                      {isActive ? "✓ Aktif" : "Kullan"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Şablon/beceri arama — Claude Design'ın composer'ındaki "Template ∨" ile
    eşleşir. Önceden kaldırılan HER ZAMAN GÖRÜNÜR şablon vitrininin aksine,
    bu tamamen isteğe bağlı: yalnız tıklanınca açılır, composer'ı kirletmez. */
export function TemplatePicker({ onPick }: { onPick: (t: StudioTemplate) => void }) {
  const { open, toggle, close, ref, align } = usePopover<HTMLDivElement>();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? STUDIO_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    : STUDIO_TEMPLATES;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Şablon"
        className="shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        <LayoutTemplate size={13} />
        <span>Şablon</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className={`${panelPos(align)} w-72 max-h-96 flex flex-col rounded-xl border border-line bg-surface elev-2 overflow-hidden`}>
          <div className="p-2 border-b border-line/60 shrink-0">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Şablon ve beceri ara…"
              className="w-full bg-bgsoft rounded-lg px-3 py-2 text-sm outline-none border border-line/60 focus:border-brand/50 transition-colors"
            />
          </div>
          <div className="overflow-auto p-2 grid grid-cols-3 gap-2">
            {filtered.length === 0 ? (
              <p className="col-span-3 text-xs text-muted/60 text-center py-4">Sonuç yok.</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onPick(t); close(); setQuery(""); }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-bgsoft/70 transition-colors"
                >
                  <span
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}55)` }}
                    aria-hidden
                  />
                  <span className="text-[10px] font-medium text-center leading-tight truncate w-full">{t.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ataçla eklenen referans görsellerin (henüz gönderilmemiş) küçük önizleme şeridi. */
export function ImagePreviewStrip({ images, onRemove }: { images: string[]; onRemove: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex gap-2 flex-wrap px-1 pb-2">
      {images.map((img, i) => (
        <div key={i} className="relative group/img">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI, next/image optimize edemez */}
          <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-line shadow-sm" />
          <button
            onClick={() => onRemove(i)}
            aria-label="Görseli kaldır"
            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red text-white grid place-items-center text-[10px] leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
