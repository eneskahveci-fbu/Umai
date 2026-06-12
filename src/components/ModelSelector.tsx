"use client";

// src/components/ModelSelector.tsx — Üst barda model seçici dropdown

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { ChevronDown, Cpu, Check } from "lucide-react";

interface Props {
  className?: string;
}

export function ModelSelector({ className = "" }: Props) {
  const models = useStore((s) => s.models);
  const activeModelId = useStore((s) => s.activeModelId);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeModel = models.find((m) => m.id === activeModelId);
  const enabledModels = models.filter((m) => m.enabled);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Hiç model yoksa
  if (enabledModels.length === 0) {
    return (
      <button
        onClick={() => setSettingsOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bgsoft border border-line text-sm text-muted hover:text-ink hover:border-amber-400/50 transition-colors ${className}`}
        title="Model ekle"
      >
        <Cpu size={14} />
        <span>Model Ekle</span>
      </button>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bgsoft border border-line hover:border-amber-400/50 transition-colors text-sm"
        title="Model seç"
        aria-label="Model seçici"
        aria-expanded={open}
      >
        <Cpu size={14} className="text-amber-400" />
        <span className="max-w-[140px] truncate">
          {activeModel?.name ?? "Model Seç"}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-line rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-line">
            <p className="text-xs text-muted font-medium">Aktif Model</p>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {enabledModels.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setActiveModel(m.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  activeModelId === m.id
                    ? "bg-amber-400/10 text-amber-400"
                    : "hover:bg-bgsoft text-ink"
                }`}
              >
                {activeModelId === m.id ? (
                  <Check size={14} className="shrink-0" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{m.name}</p>
                  <p className="text-[10px] text-muted truncate">{m.provider}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-line px-2 py-1.5">
            <button
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full text-xs text-muted hover:text-ink py-1.5 px-2 rounded-lg hover:bg-bgsoft transition-colors"
            >
              ⚙️ Modelleri Yönet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
