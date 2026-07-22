"use client";

/* Stüdyo composer'ının Claude Design'daki karşılığına eksik kalan seçenekleri:
   tasarım sistemi seçici, çoklu model seçici, şablon/beceri arama (+ görsel
   önizleme şeridi). Hem StudioHomeScreen (ilk mesaj) hem de ChatPanel (takip
   mesajları) bu AYNI bileşenleri paylaşır — iki yerde de aynı davranış/görünüm.

   Popover'lar CoderView.tsx'teki MoreMenu ile AYNI kanıtlanmış desenle
   document.body'ye createPortal edilir (position: fixed, getBoundingClientRect
   ile hesaplanan konum) — composer kontrol satırı yatay kaydırmalı
   (overflow-x-auto) olduğundan, panel BASİT bir `position: absolute` ile
   içeride kalsaydı kaydırma kabı onu kırpar ve seçenekler tıklanamaz hale
   gelirdi (canlıda görülen "seçim yapılmıyor" hatası tam olarak buydu).
   Mobilde (< 640px) dropdown yerine alttan açılan tam genişlik SHEET olur.

   Ref'ler (react-hooks/refs kuralı gereği) özel kancadan DÖNDÜRÜLMEZ — her
   bileşen kendi triggerRef/panelRef'ini yerelde tutar, kanca yalnız
   open/sheet/pos gibi ref-olmayan durumu döndürür (bkz. usePopoverPortal). */

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Cpu, LayoutTemplate, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { bundledDesignSystems } from "@/lib/designSystems";
import { STUDIO_TEMPLATES, type StudioTemplate } from "@/lib/studioTemplates";

interface PopoverPos { left?: number; right?: number; bottom?: number; top?: number; maxHeight: number }

function usePopoverPortal(
  triggerRef: RefObject<HTMLButtonElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
  desktopWidth = 256,
) {
  const [open, setOpenState] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);

  /* Tetikleyicinin ANLIK konumundan pos'u (yeniden) hesapla. Açılışta VE açıkken
     kaydırma/yeniden boyutlandırmada çağrılır → overflow-x-auto kontrol satırında
     tetikleyici kayınca fixed panel kopmasın, breakpoint geçişinde sheet/dropdown
     varyantı da güncellensin. */
  const computePos = () => {
    const isSheet = window.matchMedia("(max-width: 639px)").matches;
    setSheet(isSheet);
    if (isSheet) { setPos(null); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    /* Eşik GERÇEK panel genişliğinden türetilir (+ küçük pay). Sabit 300, w-80
       (320px) TemplatePicker panelinde sağ kenardan taşmaya yol açıyordu. */
    const spaceRight = window.innerWidth - r.left;
    const horiz = spaceRight < desktopWidth + 16
      ? { right: window.innerWidth - r.right }
      : { left: r.left };
    /* DİKEY yön: önceden panel HER ZAMAN tetikleyicinin ÜSTÜNE açılıyordu,
       yukarıda yer olup olmadığına bakmadan — composer ekranın üst kısmına
       yakınken (ör. Stüdyo ana ekranı) listenin ilk satırları viewport
       dışına (y<0) taşıp görünmez oluyordu; Şablon panelinde arama kutusu
       bile kayboluyordu. Artık üstte/altta GERÇEKTEN ne kadar yer olduğu
       ölçülüp daha GENİŞ olan tarafa açılıyor, max-height de o alana göre
       sınırlanıyor (sabit 70vh değil) — panel hiçbir yönde ekran dışına taşmaz. */
    const GAP = 8, MARGIN = 12;
    const spaceAbove = r.top - GAP - MARGIN;
    const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
    const openAbove = spaceAbove >= spaceBelow;
    const vert = openAbove
      ? { bottom: window.innerHeight - r.top + GAP, maxHeight: Math.max(120, spaceAbove) }
      : { top: r.bottom + GAP, maxHeight: Math.max(120, spaceBelow) };
    setPos({ ...horiz, ...vert });
  };
  const openPopover = () => { computePos(); setOpenState(true); };
  const close = () => setOpenState(false);
  const toggle = () => (open ? close() : openPopover());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    /* Scroll/resize'da rAF ile throttle'lı yeniden konumla (aşırı render olmasın).
       scroll capture=true → yalnız pencere değil iç kaydırıcıları da yakalar. */
    let raf = 0;
    const onReflow = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; computePos(); });
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerRef/panelRef kimliği sabit
  }, [open]);

  return { open, toggle, close, sheet, pos };
}

/** Masaüstünde konumlu dropdown, mobilde (< 640px) alttan açılan tam genişlik
    sheet — CoderView.tsx'teki MoreMenu'nün AYNI kanıtlanmış deseni. */
function PopoverPanel({
  open, sheet, pos, panelRef, onClose, title, widthClass, children,
}: {
  open: boolean;
  sheet: boolean;
  pos: PopoverPos | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  title?: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  if (sheet) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[79] bg-black/40 animate-modal-bg" onClick={onClose} />
        <div
          ref={panelRef}
          className="fixed inset-x-0 bottom-0 z-[80] bg-surface border-t border-line rounded-t-2xl shadow-2xl shadow-black/40 p-3 flex flex-col gap-0.5 max-h-[75dvh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-10 h-1 rounded-full bg-line/80 mb-1.5 shrink-0" />
          {title && <p className="text-sm font-bold px-1 pb-2">{title}</p>}
          {children}
        </div>
      </>,
      document.body,
    );
  }

  if (!pos) return null;
  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
      className={`${widthClass ?? "w-64"} overflow-auto bg-surface border border-line rounded-xl shadow-2xl shadow-black/40 z-[80] py-1.5 animate-modal-bg`}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DesignSystemPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { open, toggle, close, sheet, pos } = usePopoverPortal(triggerRef, panelRef, 224); // w-56
  const current = bundledDesignSystems.find((s) => s.id === value) ?? bundledDesignSystems[0];

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        title="Tasarım sistemi"
        className="shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        <Palette size={13} />
        <span className="max-w-[110px] truncate">{current.name}</span>
        <ChevronDown size={11} />
      </button>
      <PopoverPanel open={open} sheet={sheet} pos={pos} panelRef={panelRef} onClose={close} title="Tasarım sistemi" widthClass="w-56">
        {bundledDesignSystems.map((s) => (
          <button
            key={s.id}
            onClick={() => { onChange(s.id); close(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-left rounded-lg hover:bg-bgsoft/70 transition-colors ${s.id === value ? "bg-brand/8" : ""}`}
          >
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: s.accent }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">{s.name}</span>
              <span className="block text-[10px] text-muted/60">{s.category}</span>
            </span>
            {s.id === value && <span className="text-brand text-xs shrink-0">✓</span>}
          </button>
        ))}
      </PopoverPanel>
    </>
  );
}

export function ModelPicker({
  fusionEnabled, onFusionChange,
}: {
  fusionEnabled: boolean;
  onFusionChange: (v: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { open, toggle, close, sheet, pos } = usePopoverPortal(triggerRef, panelRef);
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
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        title={fusionEnabled ? label : `${label} — birden fazla işaretlersen Fusion (taslak + hakem) devreye girer`}
        className={`shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-medium transition-colors ${
          fusionEnabled
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-line/70 bg-bgsoft/60 text-muted hover:text-ink hover:border-brand/40"
        }`}
      >
        <Cpu size={13} />
        <span className="max-w-[140px] sm:max-w-[200px] truncate">{label}</span>
        <ChevronDown size={11} />
      </button>
      <PopoverPanel open={open} sheet={sheet} pos={pos} panelRef={panelRef} onClose={close} title="Model" widthClass="w-64">
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
              <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-bgsoft/70 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModel(m.id)}
                  className="accent-brand shrink-0 cursor-pointer w-4 h-4"
                />
                <button onClick={() => toggleModel(m.id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium truncate">{m.label}</span>
                  <span className="block text-[10px] text-muted/60">{m.provider}</span>
                </button>
                {!checked && (
                  <button
                    onClick={() => {
                      /* Tek modele geç: Fusion'ı kapat VE qualityModelIds'i temizle.
                         Önceden yalnız Fusion kapatılıp seçili id'ler kalıyordu →
                         picker tekrar açılınca 2-3 kutu işaretli ama Fusion OFF
                         (çelişki, "2+ = Fusion" değişmezini bozuyordu). */
                      setActiveModel(m.id);
                      onFusionChange(false);
                      if (qualityModelIds.length) saveConfig({ ...config, qualityModelIds: [] });
                      close();
                    }}
                    className={`text-[10px] font-semibold px-1.5 py-1 rounded shrink-0 ${isActive ? "text-brand" : "text-muted/50 hover:text-brand"}`}
                  >
                    {isActive ? "✓ Aktif" : "Kullan"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </PopoverPanel>
    </>
  );
}

/** Şablon/beceri arama — Claude Design'ın composer'ındaki "Template ∨" ile
    eşleşir. Önceden kaldırılan HER ZAMAN GÖRÜNÜR şablon vitrininin aksine,
    bu tamamen isteğe bağlı: yalnız tıklanınca açılır, composer'ı kirletmez. */
export function TemplatePicker({ onPick }: { onPick: (t: StudioTemplate) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { open, toggle, close, sheet, pos } = usePopoverPortal(triggerRef, panelRef, 320); // w-80
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? STUDIO_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    : STUDIO_TEMPLATES;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        title="Şablon"
        className="shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border border-line/70 bg-bgsoft/60 hover:border-brand/40 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        <LayoutTemplate size={13} />
        <span>Şablon</span>
        <ChevronDown size={11} />
      </button>
      <PopoverPanel open={open} sheet={sheet} pos={pos} panelRef={panelRef} onClose={close} widthClass="w-80">
        <div className="p-1 pb-2 sm:p-2 sm:pb-2 shrink-0">
          <input
            autoFocus={!sheet}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Şablon ve beceri ara…"
            className="w-full bg-bgsoft rounded-lg px-3 py-2 text-sm outline-none border border-line/60 focus:border-brand/50 transition-colors"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 px-1 sm:px-2">
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
                <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">{t.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverPanel>
    </>
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
