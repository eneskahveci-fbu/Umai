"use client";

/* Stüdyo composer'ının Claude Design'daki karşılığına eksik kalan seçenekleri:
   tasarım sistemi seçici + çoklu model seçici (+ görsel önizleme şeridi).
   Hem StudioHomeScreen (ilk mesaj) hem de ChatPanel (takip mesajları) bu AYNI
   bileşenleri paylaşır — iki yerde de aynı davranış/görünüm. */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cpu, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { bundledDesignSystems } from "@/lib/designSystems";

/** Dışarı tıklama/Escape ile kapanan açılır panel — AuthButton.tsx'teki ile aynı hafif desen. */
function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
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
  return { open, setOpen, ref };
}

export function DesignSystemPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const current = bundledDesignSystems.find((s) => s.id === value) ?? bundledDesignSystems[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Tasarım sistemi"
        className="shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        <Palette size={13} />
        <span className="max-w-[76px] truncate">{current.name}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-30 w-56 max-h-72 overflow-auto rounded-xl border border-line bg-surface elev-2 py-1.5">
          {bundledDesignSystems.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
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
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
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
        onClick={() => setOpen((v) => !v)}
        title="Model seçimi — birden fazla işaretlersen Fusion (taslak + hakem) devreye girer"
        className={`shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-medium transition-colors ${
          fusionEnabled
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-line/70 bg-bgsoft/60 text-muted hover:text-ink hover:border-brand/40"
        }`}
      >
        <Cpu size={13} />
        <span className="max-w-[96px] truncate">{label}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-30 w-64 max-h-80 overflow-auto rounded-xl border border-line bg-surface elev-2 py-1.5">
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
                      onClick={() => { setActiveModel(m.id); onFusionChange(false); setOpen(false); }}
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
