"use client";

import { useState } from "react";
import { ArrowUp, Check, FolderOpen, LayoutGrid, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { skillsByCategory, STUDIO_DIRECTIONS } from "@/lib/studioConstants";
import { allDesignSystems } from "@/lib/designSystems";
import { AccordionSection } from "@/components/Accordion";

/* Kategoriye göre ikon karosu gradyanı — görsel varlıksız (saf CSS) "önizleme"
   hissi. Bilinmeyen kategori marka tonuna düşer. */
const CAT_TILE: Record<string, string> = {
  Web: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
  Uygulama: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
  "Bileşen": "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "İçerik": "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
};
const tileBg = (cat: string) =>
  CAT_TILE[cat] ?? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 70%, #000), var(--color-brand))";

/* Stüdyo giriş ekranı (Open Design home) — brief + çıktı türü (skill) + tasarım
   sistemi (marka) + tasarım yönü seçimi → tek tık üret. Craft teması. */
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
  const [skillQuery, setSkillQuery] = useState("");
  const q = skillQuery.trim().toLowerCase();
  const groups = skillsByCategory()
    .map((g) => ({ category: g.category, skills: q ? g.skills.filter((s) => `${s.name} ${s.desc}`.toLowerCase().includes(q)) : g.skills }))
    .filter((g) => g.skills.length > 0);
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 flex flex-col gap-7">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">Ne tasarlayalım?</h1>
          <p className="text-muted text-sm mt-1.5 text-balance">Bir brief yaz, çıktı türünü ve yönünü seç — gerisini stüdyo halletsin.</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button onClick={onOpenTemplates} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-surface text-muted hover:text-ink hover:border-brand/40 transition-colors">
              <Sparkles size={13} className="text-brand" /> Hazır şablonlardan başla
            </button>
            {projectCount > 0 && (
              <button onClick={onOpenProjects} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-surface text-muted hover:text-ink hover:border-brand/40 transition-colors">
                <FolderOpen size={13} className="text-brand" /> Projelerim ({projectCount})
              </button>
            )}
          </div>
        </div>

        {/* Brief composer */}
        <div className="rounded-2xl border border-line bg-surface shadow-sm focus-within:border-brand/50 transition-colors">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onGenerate(); } }}
            rows={3}
            placeholder="Örn: SaaS analitik aracı için modern bir landing sayfası — koyu tema, mor vurgu, fiyatlandırma bölümü…"
            className="w-full bg-transparent resize-none outline-none px-4 pt-3.5 text-sm placeholder:text-muted/70 min-h-[88px]"
          />
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <span className="text-[11px] text-muted/60">⌘/Ctrl + Enter ile üret</span>
            <button
              onClick={onGenerate}
              disabled={busy || !brief.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-[#111110] font-semibold text-sm disabled:opacity-40 hover:bg-branddim transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />} Üret
            </button>
          </div>
        </div>

        {/* Çıktı türü (skill) — kategorili + aranabilir */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted/70">Çıktı türü</h3>
            <input
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder="Ara…"
              className="flex-1 max-w-44 bg-bgsoft border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand/60"
            />
          </div>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.category}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/50 mb-1.5">{g.category}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {g.skills.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSkillId(s.id)}
                      className={`relative text-left p-3 rounded-xl border transition-all ${skillId === s.id ? "border-brand bg-brand/10 ring-2 ring-brand/40" : "border-line bg-surface hover:border-brand/40 hover:-translate-y-0.5"}`}
                    >
                      {skillId === s.id && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand grid place-items-center text-white"><Check size={10} strokeWidth={3} /></span>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-8 h-8 rounded-lg grid place-items-center text-base leading-none shrink-0 shadow-sm" style={{ background: tileBg(g.category) }}>{s.icon}</span>
                        <span className={`text-sm font-semibold leading-tight ${skillId === s.id ? "text-brand" : "text-ink"}`}>{s.name}</span>
                      </div>
                      <p className="text-[11px] text-muted/80 leading-snug">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-xs text-muted/60">Eşleşen çıktı türü yok.</p>}
          </div>
        </div>

        {/* Ayrıntılar — Claude-minimal: tasarım sistemi + yön varsayılanla çalışır,
            isteyen tek katlanır bölümden değiştirir (seçim rozette görünür). */}
        <AccordionSection
          id="studio-detay"
          title="Ayrıntılar"
          defaultOpen={false}
          badge={
            <span className="text-[10px] text-muted/60 font-medium truncate max-w-[180px]">
              {(systems.find((s) => s.id === designSystemId)?.name ?? "Craft")} · {(STUDIO_DIRECTIONS.find((d) => d.id === directionId)?.name ?? "Minimal")}
            </span>
          }
        >
          <div className="space-y-4 pt-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted/70">Tasarım sistemi</h3>
                <button onClick={onBrowseSystems} className="flex items-center gap-1 text-xs text-brand hover:underline"><LayoutGrid size={12} /> Göz at</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {systems.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDesignSystemId(s.id)}
                    title={s.category}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${designSystemId === s.id ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
                  >
                    <span className="w-3 h-3 rounded-full border border-line/50 shrink-0" style={{ background: s.accent }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted/70 mb-2">Tasarım yönü</h3>
              <div className="flex flex-wrap gap-1.5">
                {STUDIO_DIRECTIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDirectionId(d.id)}
                    title={d.hint}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${directionId === d.id ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}
