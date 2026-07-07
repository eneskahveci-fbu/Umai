"use client";

/* ═══════════════════════════════════════════════════════════════════════
   STUDIO HOME — Open Design Platform Giriş Ekranı
   ═══════════════════════════════════════════════════════════════════════
   Önceki yapı: 7 araç çipi (Sunum/Doküman/Anket/Görsel/Defter)
   Yeni yapı: 3 araç çipi (Görüntü/Doküman/Defter) — Slays ve Tuval
   artık OpenDesignStudio içinde.
   ═══════════════════════════════════════════════════════════════════════ */

import { ArrowUp, BookOpen, FileText, Image as ImageIcon, FolderOpen, ListChecks, Loader2, Presentation, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { skillsByCategory, STUDIO_DIRECTIONS } from "@/lib/studioConstants";
import { allDesignSystems } from "@/lib/designSystems";
import { setSurfaceHandoff, useSurfaceNav, type Surface } from "@/lib/surfaceNav";

/* Güncellenmiş araç çipleri — Slays ve Tuval kaldırıldı (OpenDesignStudio içinde) */
const TOOL_CHIPS: { id: Surface; name: string; icon: typeof Sparkles }[] = [
  { id: "image", name: "Görsel", icon: ImageIcon },
  { id: "docs", name: "Doküman", icon: FileText },
  { id: "forms", name: "Anket", icon: ListChecks },
  { id: "notebook", name: "Defter", icon: BookOpen },
];

const selectCls =
  "flex-1 min-w-0 bg-bgsoft border border-line rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand/60 cursor-pointer";

/* Open Design Platform giriş ekranı */
export function StudioHome({
  brief, setBrief,
  skillId, setSkillId,
  directionId, setDirectionId,
  designSystemId, setDesignSystemId,
  onBrowseSystems, onOpenTemplates, onOpenProjects, projectCount,
  busy, onGenerate,
}: {
  brief: string; setBrief: (s: string) => void;
  skillId: string | null; setSkillId: (s: string) => void;
  directionId: string | null; setDirectionId: (s: string) => void;
  designSystemId: string; setDesignSystemId: (s: string) => void;
  onBrowseSystems: () => void;
  onOpenTemplates: () => void;
  onOpenProjects: () => void;
  projectCount: number;
  busy: boolean;
  onGenerate: () => void;
}) {
  const config = useStore((s) => s.config);
  const systems = allDesignSystems(config);
  const nav = useSurfaceNav();

  const goTool = (id: Surface) => {
    const b = brief.trim();
    if (b) setSurfaceHandoff(id, b);
    nav.go(id);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-20 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
            Open Design Platform
          </h1>
          <p className="text-muted text-sm mt-1.5 text-balance">
            Slayt, afiş, sosyal medya, tuval — hepsi tek workspace'te.
            Brief yaz, gerisini craft halleder.
          </p>
        </div>

        {/* Brief kartı */}
        <div className="rounded-2xl border border-line bg-surface elev-2 focus-within:border-brand/50 transition-colors">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onGenerate(); } }}
            rows={4}
            placeholder="Örn: 'SaaS analitik aracı için landing sayfası — koyu tema' ya da '5 slaytlık yatırımcı sunumu' ya da 'Kahve dükkânı için Instagram afişi'"
            className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[104px]"
          />
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-1">
            <select
              value={skillId ?? "auto"}
              onChange={(e) => setSkillId((e.target.value === "auto" ? null : e.target.value) as string)}
              aria-label="Çıktı türü"
              className={selectCls}
            >
              <option value="auto">✦ Otomatik tür</option>
              {skillsByCategory().map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.skills.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={designSystemId}
              onChange={(e) => {
                if (e.target.value === "__browse") { onBrowseSystems(); return; }
                setDesignSystemId(e.target.value);
              }}
              aria-label="Tasarım sistemi"
              className={selectCls}
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__browse">＋ Göz at / içe aktar…</option>
            </select>
            <select
              value={directionId ?? ""}
              onChange={(e) => setDirectionId(e.target.value)}
              aria-label="Tasarım yönü"
              className={`${selectCls} hidden sm:block`}
            >
              {STUDIO_DIRECTIONS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={onGenerate}
              disabled={busy || !brief.trim()}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />} Üret
            </button>
          </div>
        </div>

        {/* Araç çipleri — Slays ve Tuval artık OpenDesignStudio içinde */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted/50">
            {brief.trim() ? "Bu brief ile:" : "Diğer araçlar:"}
          </span>
          {TOOL_CHIPS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => goTool(t.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-line/60 hover:border-brand/50 text-[11px] text-muted hover:text-ink transition-colors"
              >
                <Icon size={11} className="text-brand" /> {t.name}
              </button>
            );
          })}
        </div>

        {/* Bilgi notu */}
        <div className="text-center text-[11px] text-muted/40 mt-2">
          <span className="font-semibold">Open Design</span> —
          Slayt, afiş, sosyal medya ve tuval artık tek workspace'te.
          Dilediğin formatta üret, dilediğin formata dönüştür.
        </div>

        {/* Sessiz bağlantılar */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted/80">
          <button onClick={onOpenTemplates} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
            <Sparkles size={13} className="text-brand" /> Hazır şablonlar
          </button>
          {projectCount > 0 && (
            <button onClick={onOpenProjects} className="inline-flex items-center gap-1.5 hover:text-ink transition-colors">
              <FolderOpen size={13} className="text-brand" /> Projelerim ({projectCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
