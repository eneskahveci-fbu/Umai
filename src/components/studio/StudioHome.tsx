"use client";

import { useState } from "react";
import { ArrowUp, FolderOpen, LayoutGrid, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { skillsByCategory, STUDIO_DIRECTIONS } from "@/lib/studioConstants";
import { allDesignSystems } from "@/lib/designSystems";

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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ne tasarlayalım?</h1>
          <p className="text-muted text-sm mt-1.5">Bir brief yaz, çıktı türünü ve yönünü seç — gerisini stüdyo halletsin.</p>
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
              className="w-28 sm:w-40 bg-bgsoft border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-brand/60"
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
                      className={`text-left p-3 rounded-xl border transition-colors ${skillId === s.id ? "border-brand bg-brand/10" : "border-line bg-surface hover:border-brand/40"}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base leading-none">{s.icon}</span>
                        <span className={`text-sm font-semibold ${skillId === s.id ? "text-brand" : "text-ink"}`}>{s.name}</span>
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

        {/* Tasarım sistemi (marka) */}
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

        {/* Tasarım yönü */}
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
    </div>
  );
}
